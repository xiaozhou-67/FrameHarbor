import type { Order } from '../../shared/domain.ts';
import { db } from './db.ts';
import { assert } from './errors.ts';

export const orderSelect = `SELECT o.id,o.user_id userId,o.show_id showId,s.movie_id movieId,m.title movieTitle,m.poster,
  c.name cinemaName,h.name hallName,h.format,s.starts_at startsAt,s.ends_at endsAt,o.seats_json seatsJson,
  o.subtotal_cents subtotalCents,o.discount_cents discountCents,o.total_cents totalCents,o.coupon_code couponCode,
  o.status,o.expires_at expiresAt,o.created_at createdAt,o.ticket_code ticketCode,o.checked_in_at checkedInAt,u.display_name displayName
  FROM orders o JOIN shows s ON s.id=o.show_id JOIN movies m ON m.id=s.movie_id
  JOIN halls h ON h.id=s.hall_id JOIN cinemas c ON c.id=h.cinema_id JOIN users u ON u.id=o.user_id`;
interface OrderRow extends Omit<Order, 'seats'> {
  seatsJson: string;
}
export function orderDTO(row: OrderRow): Order {
  const { seatsJson, ...rest } = row;
  return { ...rest, seats: JSON.parse(seatsJson) as string[] };
}
export function getOrder(id: string) {
  const row = db.get<OrderRow>(`${orderSelect} WHERE o.id=?`, id);
  return row ? orderDTO(row) : undefined;
}
export function ownOrder(id: string, userId: number): Order {
  const order = getOrder(id);
  assert(order && order.userId === userId, 404, 'ORDER_NOT_FOUND', '订单不存在');
  return order;
}
export function allOrders(userId?: number): Order[] {
  return db
    .all<OrderRow>(
      `${orderSelect} ${userId ? 'WHERE o.user_id=?' : ''} ORDER BY o.created_at DESC`,
      ...(userId ? [userId] : []),
    )
    .map(orderDTO);
}
export function releaseOrder(id: string) {
  db.run('DELETE FROM seat_claims WHERE order_id=?', id);
  db.run('DELETE FROM coupon_uses WHERE order_id=?', id);
}
// Only call within a transaction. This also clears stale reservations after process downtime.
export function cleanupExpired(now = Date.now()) {
  db.run("UPDATE orders SET status='expired' WHERE status='pending' AND expires_at<=?", now);
  db.run(
    "DELETE FROM seat_claims WHERE order_id IN (SELECT id FROM orders WHERE status IN ('expired','cancelled','refunded'))",
  );
  db.run(
    "DELETE FROM coupon_uses WHERE order_id IN (SELECT id FROM orders WHERE status IN ('expired','cancelled','refunded'))",
  );
}
export function expireOrders() {
  db.transaction(() => cleanupExpired());
}
