import { Router } from 'express';
import { z } from 'zod';
import type { AuditLog, Dashboard, Review, Show } from '../../shared/domain.ts';
import { BUSINESS } from '../../shared/domain.ts';
import {
  cinemaSchema,
  hallSchema,
  idSchema,
  moderationSchema,
  movieSchema,
  showSchema,
} from '../../shared/validation.ts';
import { requireAdmin } from './auth.ts';
import { getHalls, getMovie, getShow, listCinemas, listMovies, paginate, showSelect } from './catalog.ts';
import { reviewSelect } from './community.ts';
import { audit, db } from './db.ts';
import { assert } from './errors.ts';
import { allOrders, cleanupExpired, expireOrders, getOrder, releaseOrder } from './order-store.ts';

export const adminRouter = Router();
adminRouter.use(requireAdmin);
adminRouter.get('/dashboard', (_req, res) => {
  expireOrders();
  const metrics = db.get<{ revenueCents: number; paidOrders: number; tickets: number }>(
    `SELECT COALESCE(SUM(total_cents),0) revenueCents,COUNT(*) paidOrders,COALESCE(SUM(seat_count),0) tickets FROM orders WHERE status='paid'`,
  )!;
  const capacity = db.get<{ seats: number; sold: number; shows: number }>(
    `SELECT COUNT(*) shows,COALESCE(SUM(h.rows_count*h.columns_count),0) seats,
    COALESCE(SUM((SELECT COUNT(*) FROM seat_claims sc JOIN orders o ON o.id=sc.order_id WHERE sc.show_id=s.id AND o.status='paid')),0) sold
    FROM shows s JOIN halls h ON h.id=s.hall_id WHERE s.status='active' AND s.starts_at BETWEEN ? AND ?`,
    Date.now(),
    Date.now() + 7 * 86400000,
  )!;
  const rawDaily = db.all<{ day: string; revenueCents: number; orders: number }>(
    `SELECT strftime('%Y-%m-%d',paid_at/1000,'unixepoch','+8 hours') day, SUM(total_cents) revenueCents,COUNT(*) orders
    FROM orders WHERE status='paid' AND paid_at>=? GROUP BY day`,
    Date.now() - 7 * 86400000,
  );
  const daily = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(Date.now() - (6 - i) * 86400000).toLocaleDateString('en-CA', {
      timeZone: BUSINESS.timezone,
    });
    return rawDaily.find((d) => d.day === day) ?? { day, revenueCents: 0, orders: 0 };
  });
  const data: Dashboard = {
    ...metrics,
    daily,
    activeShows: capacity.shows,
    occupancyPercent: capacity.seats ? Math.round((capacity.sold / capacity.seats) * 1000) / 10 : 0,
    pendingReviews: db.get<{ n: number }>("SELECT COUNT(*) n FROM reviews WHERE status='pending'")!.n,
    popular: db.all(
      `SELECT m.title,SUM(o.seat_count) tickets,SUM(o.total_cents) revenueCents FROM orders o JOIN shows s ON s.id=o.show_id JOIN movies m ON m.id=s.movie_id WHERE o.status='paid' GROUP BY m.id ORDER BY tickets DESC LIMIT 5`,
    ),
  };
  res.json({ data });
});
adminRouter.get('/movies', (_req, res) => res.json({ data: listMovies() }));
adminRouter.post('/movies', (req, res) => {
  const m = movieSchema.parse(req.body);
  const movie = db.transaction(() => {
    const result = db.run(
      `INSERT INTO movies(title,english_title,genre,duration_minutes,language,release_date,synopsis,director,cast_json,poster,accent,status,featured,editorial_score) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      m.title,
      m.englishTitle,
      m.genre,
      m.durationMinutes,
      m.language,
      m.releaseDate,
      m.synopsis,
      m.director,
      JSON.stringify(m.cast),
      m.poster,
      m.accent,
      m.status,
      Number(m.featured),
      m.editorialScore,
    );
    const id = Number(result.lastInsertRowid);
    audit(req.auth!.user.id, 'movie.create', String(id), m.title);
    return getMovie(id);
  });
  res.status(201).json({ data: movie });
});
adminRouter.put('/movies/:id', (req, res) => {
  const id = idSchema.parse(req.params.id);
  const m = movieSchema.parse(req.body);
  const movie = db.transaction(() => {
    const old = getMovie(id);
    assert(old, 404, 'MOVIE_NOT_FOUND', '影片不存在');
    const scheduled = db.get(
      "SELECT 1 FROM shows WHERE movie_id=? AND status='active' AND ends_at>? LIMIT 1",
      id,
      Date.now(),
    );
    assert(
      !scheduled || (old.durationMinutes === m.durationMinutes && m.status === 'now'),
      409,
      'MOVIE_SCHEDULED',
      '影片存在未结束的排片，请先取消排片，再调整时长或下架',
    );
    db.run(
      `UPDATE movies SET title=?,english_title=?,genre=?,duration_minutes=?,language=?,release_date=?,synopsis=?,director=?,cast_json=?,poster=?,accent=?,status=?,featured=?,editorial_score=? WHERE id=?`,
      m.title,
      m.englishTitle,
      m.genre,
      m.durationMinutes,
      m.language,
      m.releaseDate,
      m.synopsis,
      m.director,
      JSON.stringify(m.cast),
      m.poster,
      m.accent,
      m.status,
      Number(m.featured),
      m.editorialScore,
      id,
    );
    audit(req.auth!.user.id, 'movie.update', String(id), m.title);
    return getMovie(id);
  });
  res.json({ data: movie });
});
adminRouter.get('/cinemas', (_req, res) => res.json({ data: listCinemas() }));
adminRouter.post('/cinemas', (req, res) => {
  const c = cinemaSchema.parse(req.body);
  const id = db.transaction(() => {
    const result = db.run(
      'INSERT INTO cinemas(name,city,district,address,tags_json,description) VALUES(?,?,?,?,?,?)',
      c.name,
      c.city,
      c.district,
      c.address,
      JSON.stringify(c.tags),
      c.description,
    );
    const id = Number(result.lastInsertRowid);
    audit(req.auth!.user.id, 'cinema.create', String(id), c.name);
    return id;
  });
  res.status(201).json({ data: listCinemas().find((c) => c.id === id) });
});
adminRouter.put('/cinemas/:id', (req, res) => {
  const id = idSchema.parse(req.params.id);
  const c = cinemaSchema.parse(req.body);
  db.transaction(() => {
    assert(db.get('SELECT id FROM cinemas WHERE id=?', id), 404, 'CINEMA_NOT_FOUND', '影院不存在');
    db.run(
      'UPDATE cinemas SET name=?,city=?,district=?,address=?,tags_json=?,description=? WHERE id=?',
      c.name,
      c.city,
      c.district,
      c.address,
      JSON.stringify(c.tags),
      c.description,
      id,
    );
    audit(req.auth!.user.id, 'cinema.update', String(id), c.name);
  });
  res.json({ data: listCinemas().find((c) => c.id === id) });
});
adminRouter.get('/halls', (_req, res) => res.json({ data: getHalls() }));
function checkHall(input: z.infer<typeof hallSchema>, id = 0) {
  assert(db.get('SELECT id FROM cinemas WHERE id=?', input.cinemaId), 404, 'CINEMA_NOT_FOUND', '影院不存在');
  assert(
    !db.get('SELECT id FROM halls WHERE cinema_id=? AND name=? AND id!=?', input.cinemaId, input.name, id),
    409,
    'HALL_EXISTS',
    '此影院已有同名影厅',
  );
}
adminRouter.post('/halls', (req, res) => {
  const h = hallSchema.parse(req.body);
  const id = db.transaction(() => {
    checkHall(h);
    const result = db.run(
      'INSERT INTO halls(cinema_id,name,format,rows_count,columns_count) VALUES(?,?,?,?,?)',
      h.cinemaId,
      h.name,
      h.format,
      h.rows,
      h.columns,
    );
    const id = Number(result.lastInsertRowid);
    audit(req.auth!.user.id, 'hall.create', String(id), h.name);
    return id;
  });
  res.status(201).json({ data: getHalls().find((h) => h.id === id) });
});
adminRouter.put('/halls/:id', (req, res) => {
  const id = idSchema.parse(req.params.id);
  const h = hallSchema.parse(req.body);
  db.transaction(() => {
    const old = getHalls().find((h) => h.id === id);
    assert(old, 404, 'HALL_NOT_FOUND', '影厅不存在');
    checkHall(h, id);
    const hasShows = db.get('SELECT 1 FROM shows WHERE hall_id=? LIMIT 1', id);
    assert(
      !hasShows ||
        (old.rows === h.rows &&
          old.columns === h.columns &&
          old.cinemaId === h.cinemaId &&
          old.format === h.format),
      409,
      'HALL_IN_USE',
      '已有排片历史的影厅仅可改名；调整布局请新建影厅',
    );
    db.run(
      'UPDATE halls SET cinema_id=?,name=?,format=?,rows_count=?,columns_count=? WHERE id=?',
      h.cinemaId,
      h.name,
      h.format,
      h.rows,
      h.columns,
      id,
    );
    audit(req.auth!.user.id, 'hall.update', String(id), h.name);
  });
  res.json({ data: getHalls().find((h) => h.id === id) });
});
adminRouter.get('/shows', (req, res) => {
  expireOrders();
  const cinemaId = req.query.cinemaId ? idSchema.parse(req.query.cinemaId) : undefined;
  const movieId = req.query.movieId ? idSchema.parse(req.query.movieId) : undefined;
  const status = z.enum(['active', 'cancelled', 'all']).default('all').parse(req.query.status);
  const items = db
    .all<Show>(`${showSelect} ORDER BY s.starts_at DESC`)
    .filter(
      (s) =>
        (!cinemaId || s.cinemaId === cinemaId) &&
        (!movieId || s.movieId === movieId) &&
        (status === 'all' || s.status === status),
    );
  res.json({ data: paginate(items, req) });
});
adminRouter.post('/shows', (req, res) => {
  const input = showSchema.parse(req.body);
  const show = db.transaction(() => {
    const movie = getMovie(input.movieId);
    assert(movie?.status === 'now', 400, 'MOVIE_STATUS', '只可为正在上映的影片排片');
    assert(db.get('SELECT id FROM halls WHERE id=?', input.hallId), 404, 'HALL_NOT_FOUND', '影厅不存在');
    assert(
      input.startsAt > Date.now() + 15 * 60000 && input.startsAt < Date.now() + 90 * 86400000,
      400,
      'SHOW_TIME',
      '排片需在 15 分钟后至 90 天内',
    );
    const endsAt = input.startsAt + movie.durationMinutes * 60000;
    const cleanup = BUSINESS.cleanupMinutes * 60000;
    const overlap = db.get(
      "SELECT id FROM shows WHERE hall_id=? AND status='active' AND starts_at<? AND ends_at+?>? LIMIT 1",
      input.hallId,
      endsAt + cleanup,
      cleanup,
      input.startsAt,
    );
    assert(!overlap, 409, 'SHOW_OVERLAP', '与现有排片或 20 分钟清场时间冲突');
    const result = db.run(
      'INSERT INTO shows(movie_id,hall_id,starts_at,ends_at,price_cents) VALUES(?,?,?,?,?)',
      input.movieId,
      input.hallId,
      input.startsAt,
      endsAt,
      input.priceCents,
    );
    const id = Number(result.lastInsertRowid);
    audit(req.auth!.user.id, 'show.create', String(id), `${movie.title} @ ${input.startsAt}`);
    return getShow(id);
  });
  res.status(201).json({ data: show });
});
adminRouter.post('/shows/:id/cancel', (req, res) => {
  const id = idSchema.parse(req.params.id);
  const show = db.transaction(() => {
    cleanupExpired();
    const s = getShow(id);
    assert(s, 404, 'SHOW_NOT_FOUND', '场次不存在');
    if (s.status === 'cancelled') return s;
    assert(
      s.startsAt > Date.now() &&
        !db.get('SELECT 1 FROM orders WHERE show_id=? AND checked_in_at IS NOT NULL', id),
      409,
      'SHOW_STARTED',
      '已开场或已核销的场次无法取消',
    );
    const affected = db.all<{ id: string; status: string }>(
      "SELECT id,status FROM orders WHERE show_id=? AND status IN ('pending','paid')",
      id,
    );
    for (const order of affected) {
      db.run(
        'UPDATE orders SET status=?,refunded_at=? WHERE id=?',
        order.status === 'paid' ? 'refunded' : 'cancelled',
        order.status === 'paid' ? Date.now() : null,
        order.id,
      );
      releaseOrder(order.id);
    }
    db.run("UPDATE shows SET status='cancelled' WHERE id=?", id);
    audit(req.auth!.user.id, 'show.cancel', String(id), `处理 ${affected.length} 个订单`);
    return getShow(id);
  });
  res.json({ data: show });
});
adminRouter.get('/orders', (req, res) => {
  expireOrders();
  const q = z.string().max(100).default('').parse(req.query.q).toLowerCase();
  const status = z
    .enum(['all', 'pending', 'paid', 'cancelled', 'expired', 'refunded'])
    .default('all')
    .parse(req.query.status);
  res.json({
    data: paginate(
      allOrders().filter(
        (o) =>
          (status === 'all' || o.status === status) &&
          `${o.id}${o.ticketCode ?? ''}${o.movieTitle}${o.displayName}`.toLowerCase().includes(q),
      ),
      req,
    ),
  });
});
adminRouter.post('/orders/:id/check-in', (req, res) => {
  const id = z.uuid().parse(req.params.id);
  const order = db.transaction(() => {
    const o = getOrder(id);
    assert(o, 404, 'ORDER_NOT_FOUND', '订单不存在');
    assert(o.status === 'paid', 409, 'ORDER_STATE', '仅已出票订单可核销');
    if (o.checkedInAt) return o;
    assert(
      Date.now() >= o.startsAt - 2 * 3600000 && Date.now() <= o.endsAt + 30 * 60000,
      409,
      'CHECKIN_WINDOW',
      '核销开放时间为开场前 2 小时至散场后 30 分钟',
    );
    db.run('UPDATE orders SET checked_in_at=? WHERE id=?', Date.now(), id);
    audit(req.auth!.user.id, 'order.check-in', id, o.ticketCode ?? '');
    return getOrder(id);
  });
  res.json({ data: order });
});
adminRouter.get('/reviews', (req, res) => {
  const status = z
    .enum(['all', 'pending', 'approved', 'rejected'])
    .default('pending')
    .parse(req.query.status);
  res.json({
    data: paginate(
      db.all<Review>(
        `${reviewSelect} ${status === 'all' ? '' : 'WHERE r.status=?'} ORDER BY r.created_at DESC`,
        ...(status === 'all' ? [] : [status]),
      ),
      req,
    ),
  });
});
adminRouter.put('/reviews/:id', (req, res) => {
  const id = idSchema.parse(req.params.id);
  const input = moderationSchema.parse(req.body);
  db.transaction(() => {
    assert(db.get('SELECT id FROM reviews WHERE id=?', id), 404, 'REVIEW_NOT_FOUND', '评论不存在');
    const result = db.run(
      'UPDATE reviews SET status=?,revision=revision+1 WHERE id=? AND revision=?',
      input.status,
      id,
      input.revision,
    );
    assert(result.changes === 1, 409, 'REVIEW_CHANGED', '影评已更新，请重新阅读最新内容再审核');
    audit(req.auth!.user.id, 'review.moderate', String(id), input.status);
  });
  res.json({ data: { ok: true } });
});
adminRouter.get('/logs', (req, res) =>
  res.json({
    data: paginate(
      db.all<AuditLog>(
        `SELECT a.id,u.display_name actorName,a.action,a.target,a.detail,a.created_at createdAt FROM audit_logs a JOIN users u ON u.id=a.actor_id ORDER BY a.id DESC`,
      ),
      req,
    ),
  }),
);
