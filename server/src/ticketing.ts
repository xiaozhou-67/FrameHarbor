import { randomBytes, randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { BUSINESS, type Quote, type Seat, type Show } from '../../shared/domain.ts';
import { idSchema, orderSchema, type OrderInput } from '../../shared/validation.ts';
import { requireAuth } from './auth.ts';
import { getShow, paginate } from './catalog.ts';
import { config } from './config.ts';
import { db } from './db.ts';
import { assert } from './errors.ts';
import { allOrders, cleanupExpired, expireOrders, getOrder, ownOrder, releaseOrder } from './order-store.ts';

function availableShow(id: number): Show {
  const show = getShow(id);
  assert(show && show.status === 'active', 404, 'SHOW_UNAVAILABLE', '场次已下架');
  const movie = db.get<{ status: string }>('SELECT status FROM movies WHERE id=?', show.movieId);
  assert(
    movie?.status === 'now' && show.startsAt > Date.now() + BUSINESS.stopSalesMinutes * 60000,
    409,
    'SALES_CLOSED',
    '该场次已停止售票，请选择其他场次',
  );
  return show;
}
function validateSeats(show: Show, seats: string[]) {
  for (const seat of seats) {
    const [, row, column] = /^R(\d+)-C(\d+)$/.exec(seat)!;
    assert(
      Number(row) >= 1 &&
        Number(row) <= show.rows &&
        Number(column) >= 1 &&
        Number(column) <= show.columns &&
        seat === `R${Number(row)}-C${Number(column)}`,
      400,
      'INVALID_SEAT',
      '座位超出影厅范围',
    );
  }
}
function quoteFor(input: OrderInput, userId: number, show: Show): Quote {
  validateSeats(show, input.seats);
  const subtotalCents = show.priceCents * input.seats.length;
  let discountCents = 0;
  if (input.couponCode) {
    assert(input.couponCode === 'FIRSTFRAME', 400, 'COUPON_INVALID', '优惠码不存在');
    assert(subtotalCents >= 6000, 400, 'COUPON_THRESHOLD', 'FIRSTFRAME 满 ¥60 可用');
    assert(
      !db.get('SELECT 1 FROM coupon_uses WHERE user_id=? AND coupon_code=?', userId, input.couponCode),
      409,
      'COUPON_USED',
      '此优惠已使用或被待支付订单占用',
    );
    discountCents = 1000;
  }
  return {
    subtotalCents,
    discountCents,
    totalCents: subtotalCents - discountCents,
    couponCode: input.couponCode || null,
  };
}
export const ticketingRouter = Router();
ticketingRouter.get('/shows/:id/seats', (req, res) => {
  expireOrders();
  const show = availableShow(idSchema.parse(req.params.id));
  const claims = db.all<{ seat: string; status: string; userId: number }>(
    `SELECT sc.seat,o.status,o.user_id userId FROM seat_claims sc JOIN orders o ON o.id=sc.order_id WHERE sc.show_id=?`,
    show.id,
  );
  const bySeat = new Map(claims.map((c) => [c.seat, c]));
  const seats: Seat[] = [];
  for (let row = 1; row <= show.rows; row++)
    for (let column = 1; column <= show.columns; column++) {
      const id = `R${row}-C${column}`;
      const claim = bySeat.get(id);
      const state = !claim
        ? 'available'
        : claim.status === 'paid'
          ? 'sold'
          : claim.userId === req.auth?.user.id
            ? 'mine'
            : 'held';
      seats.push({ id, row, column, state });
    }
  res.json({ data: { show, seats, maxPerOrder: BUSINESS.maxSeats } });
});
ticketingRouter.get('/booking-config', (_req, res) =>
  res.json({ data: { demoPayments: config.demoPayments, ...BUSINESS } }),
);
ticketingRouter.use('/orders', requireAuth);
ticketingRouter.post('/orders/quote', (req, res) => {
  const input = orderSchema.parse(req.body);
  const quote = db.transaction(() => {
    cleanupExpired();
    return quoteFor(input, req.auth!.user.id, availableShow(input.showId));
  });
  res.json({ data: quote });
});
ticketingRouter.get('/orders', (req, res) => {
  expireOrders();
  res.json({ data: paginate(allOrders(req.auth!.user.id), req) });
});
ticketingRouter.post('/orders', (req, res) => {
  const input = orderSchema.parse(req.body);
  const userId = req.auth!.user.id;
  const order = db.transaction(() => {
    cleanupExpired();
    const pending = db.get<{ id: string }>(
      "SELECT id FROM orders WHERE user_id=? AND status='pending'",
      userId,
    );
    if (pending) {
      const existing = getOrder(pending.id)!;
      assert(
        existing.showId === input.showId &&
          existing.couponCode === (input.couponCode || null) &&
          [...existing.seats].sort().join(',') === [...input.seats].sort().join(','),
        409,
        'PENDING_ORDER',
        '你有一个待支付订单，请先在「我的票夹」中完成或取消',
      );
      return existing;
    }
    const show = availableShow(input.showId);
    const quote = quoteFor(input, userId, show);
    for (const seat of input.seats)
      assert(
        !db.get('SELECT 1 FROM seat_claims WHERE show_id=? AND seat=?', show.id, seat),
        409,
        'SEAT_TAKEN',
        '所选座位刚被预订，请刷新座位后重选',
      );
    const id = randomUUID();
    const now = Date.now();
    db.run(
      `INSERT INTO orders(id,user_id,show_id,seats_json,seat_count,subtotal_cents,discount_cents,total_cents,coupon_code,status,expires_at,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,'pending',?,?)`,
      id,
      userId,
      show.id,
      JSON.stringify(input.seats),
      input.seats.length,
      quote.subtotalCents,
      quote.discountCents,
      quote.totalCents,
      quote.couponCode,
      Math.min(now + BUSINESS.holdMinutes * 60000, show.startsAt),
      now,
    );
    for (const seat of input.seats)
      db.run('INSERT INTO seat_claims(show_id,seat,order_id) VALUES(?,?,?)', show.id, seat, id);
    if (quote.couponCode)
      db.run(
        'INSERT INTO coupon_uses(user_id,coupon_code,order_id) VALUES(?,?,?)',
        userId,
        quote.couponCode,
        id,
      );
    return getOrder(id)!;
  });
  res.status(201).json({ data: order });
});
ticketingRouter.get('/orders/:id', (req, res) => {
  expireOrders();
  res.json({ data: ownOrder(z.uuid().parse(req.params.id), req.auth!.user.id) });
});
ticketingRouter.post('/orders/:id/pay', (req, res) => {
  assert(config.demoPayments, 409, 'PAYMENT_DISABLED', '当前环境未启用演示支付');
  z.object({ confirmDemo: z.literal(true) }).parse(req.body);
  expireOrders();
  const order = db.transaction(() => {
    cleanupExpired();
    const current = ownOrder(z.uuid().parse(req.params.id), req.auth!.user.id);
    if (current.status === 'paid') return current;
    assert(current.status === 'pending', 409, 'ORDER_CLOSED', '订单已关闭，请重新选座');
    const show = getShow(current.showId);
    assert(show?.status === 'active' && show.startsAt > Date.now(), 409, 'SHOW_CLOSED', '场次已经关闭');
    db.run(
      "UPDATE orders SET status='paid',paid_at=?,ticket_code=? WHERE id=? AND status='pending'",
      Date.now(),
      `FH-${randomBytes(6).toString('hex').toUpperCase()}`,
      current.id,
    );
    return getOrder(current.id)!;
  });
  res.json({ data: order });
});
ticketingRouter.post('/orders/:id/cancel', (req, res) => {
  expireOrders();
  const order = db.transaction(() => {
    cleanupExpired();
    const current = ownOrder(z.uuid().parse(req.params.id), req.auth!.user.id);
    if (current.status === 'cancelled' || current.status === 'expired') return current;
    assert(current.status === 'pending', 409, 'ORDER_STATE', '已支付订单请使用退票功能');
    db.run("UPDATE orders SET status='cancelled' WHERE id=?", current.id);
    releaseOrder(current.id);
    return getOrder(current.id)!;
  });
  res.json({ data: order });
});
ticketingRouter.post('/orders/:id/refund', (req, res) => {
  const order = db.transaction(() => {
    const current = ownOrder(z.uuid().parse(req.params.id), req.auth!.user.id);
    if (current.status === 'refunded') return current;
    assert(current.status === 'paid' && !current.checkedInAt, 409, 'ORDER_STATE', '该订单当前无法退票');
    assert(
      current.startsAt - Date.now() >= BUSINESS.refundMinutes * 60000,
      409,
      'REFUND_WINDOW',
      '距开场不足 45 分钟，已停止退票',
    );
    db.run("UPDATE orders SET status='refunded',refunded_at=? WHERE id=?", Date.now(), current.id);
    releaseOrder(current.id);
    return getOrder(current.id)!;
  });
  res.json({ data: order });
});
