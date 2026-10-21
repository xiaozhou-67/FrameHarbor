# API 契约

根路径 `/api`。成功响应 `{ "data": ... }`；错误 `{ "error": { "code": "...", "message": "..." } }`。
分页响应 `{items,total,page,pageSize}`，`page>=1`，`pageSize` 默认 20、最大 100。金额字段均以 `Cents` 结尾，单位为分；时间为 UTC epoch 毫秒。

所有写接口要求 JSON 与 `X-FrameHarbor-Request: 1`；浏览器 Origin 与 APP_ORIGIN 一致。认证后另需 `X-CSRF-Token`，其值来自登录/注册或 `GET /auth/me`。凭据是 HttpOnly Cookie，用户身份从服务端会话读取。前端请求统一使用 `web/src/api.ts`。

## 身份与用户

| 方法         | 路径                   | 请求 / 结果                                                     | 权限           |
| ------------ | ---------------------- | --------------------------------------------------------------- | -------------- |
| GET          | /auth/me               | `{user,csrfToken}`，未登录均为 null                             | 公开           |
| POST         | /auth/register         | `{email,password,displayName}` → 会话；密码 12–128 位           | 公开、注册限流 |
| POST         | /auth/login            | `{email,password}` → 会话                                       | 公开、登录限流 |
| POST         | /auth/logout           | `{}` → `{ok:true}`                                              | 登录           |
| PUT          | /me/profile            | `{displayName,genres}` → User                                   | 本人           |
| GET          | /me/watchlist          | Movie[]                                                         | 本人           |
| PUT / DELETE | /me/watchlist/:movieId | `{}` → `{watchlisted}`，幂等                                    | 本人           |
| GET          | /me/reviews            | Review[]，包含审核状态                                          | 本人           |
| PUT          | /me/reviews/:movieId   | `{rating,content}` → Review；20–1000 字；每影片一条，修改后重审 | 本人           |

## 电影、影院、场次

| 方法 | 路径                | 参数 / 返回                                                                       |
| ---- | ------------------- | --------------------------------------------------------------------------------- |
| GET  | /health             | 服务名及状态                                                                      |
| GET  | /meta               | 类型、已配置城市                                                                  |
| GET  | /movies             | q、genre、status(now/soon/all)、sort(featured/rating/release)、分页 → Page<Movie> |
| GET  | /movies/:id         | Movie；归档影片返回 404                                                           |
| GET  | /movies/:id/reviews | 分页 → 已审核 Page<Review>                                                        |
| GET  | /recommendations    | 最多 4 条 `{movie,reason}`，偏好与想看类型加权                                    |
| GET  | /cinemas            | q、city → Cinema[]，含当前起价                                                    |
| GET  | /cinemas/:id        | `{cinema,halls}`                                                                  |
| GET  | /shows              | movieId、cinemaId、day(YYYY-MM-DD)、分页 → Page<Show>；提前 15 分钟停售           |
| GET  | /shows/:id/seats    | `{show,seats,maxPerOrder}`；座位 ID `R3-C7`，状态 available/held/sold/mine        |
| GET  | /booking-config     | 演示支付开关、保留/退款/停售等业务常量                                            |

## 票务（均需登录）

| 方法 | 路径                 | 请求 / 结果                                               |
| ---- | -------------------- | --------------------------------------------------------- |
| POST | /orders/quote        | `{showId,seats,couponCode?}` → Quote                      |
| POST | /orders              | 同报价输入 → Order，事务内占座；每人同时最多一个 pending  |
| GET  | /orders              | 分页 → 本人 Page<Order>                                   |
| GET  | /orders/:uuid        | 本人 Order                                                |
| POST | /orders/:uuid/pay    | `{confirmDemo:true}` → paid Order；显式开启 DEMO_PAYMENTS |
| POST | /orders/:uuid/cancel | `{}` → cancelled Order，仅 pending；已取消/超时幂等返回   |
| POST | /orders/:uuid/refund | `{}` → refunded Order，仅未核销 paid 且距开场至少 45 分钟 |

订单状态机：`pending → paid / cancelled / expired`，`paid → refunded`。管理员取消场次也处理上述状态。支付/取消/退款重试返回同类操作结果，无法跨状态重复收费。订单 ID、票码、金额、有效期均由服务端生成。

`FIRSTFRAME` 满 6000 分减 1000 分，每用户一次。创建订单时占用，支付后保留，取消/过期/退款时释放。座位占用以 `(show_id,seat)` 唯一键防重；8 分钟超时在票务读写入口惰性清理，不依赖进程计时器。

## 运营（统一 requireAdmin）

| 方法       | 路径                         | 请求 / 返回                                                                                  |
| ---------- | ---------------------------- | -------------------------------------------------------------------------------------------- |
| GET        | /admin/dashboard             | Dashboard：有效票款、已售票数、待审数、未来 7 天已售上座率、近 7 天票款、热门片              |
| GET / POST | /admin/movies                | Movie[] / MovieInput → Movie                                                                 |
| PUT        | /admin/movies/:id            | MovieInput → Movie；未结束排片保护                                                           |
| GET / POST | /admin/cinemas               | Cinema[] / CinemaInput → Cinema                                                              |
| PUT        | /admin/cinemas/:id           | CinemaInput → Cinema                                                                         |
| GET / POST | /admin/halls                 | Hall[] / HallInput → Hall                                                                    |
| PUT        | /admin/halls/:id             | HallInput → Hall；历史布局保护                                                               |
| GET        | /admin/shows                 | cinemaId、movieId、status(active/cancelled/all)、分页 → Page<Show>                           |
| POST       | /admin/shows                 | `{movieId,hallId,startsAt,priceCents}` → Show；计算散场与清场冲突                            |
| POST       | /admin/shows/:id/cancel      | `{}` → Show；开场前且无核销记录才允许，关联订单原子处理                                      |
| GET        | /admin/orders                | q(取票码/订单ID/片名/昵称)、status、分页 → Page<Order>                                       |
| POST       | /admin/orders/:uuid/check-in | `{}` → Order；开场前 2h 至结束后 30min                                                       |
| GET        | /admin/reviews               | status(pending/approved/rejected/all)、分页 → Page<Review>                                   |
| PUT        | /admin/reviews/:id           | `{status,revision}` → `{ok:true}`，status 为 approved 或 rejected；revision 必须匹配所见版本 |
| GET        | /admin/logs                  | 分页 → Page<AuditLog>                                                                        |

输入对象完整字段与类型见 `shared/validation.ts`，响应 DTO 见 `shared/domain.ts`。本版本使用新增/编辑/归档和取消操作保留业务历史。

常用错误：401 AUTH_REQUIRED/BAD_CREDENTIALS；403 CSRF/ORIGIN/ADMIN_REQUIRED；409 SEAT_TAKEN/PENDING_ORDER/ORDER_CLOSED/SHOW_OVERLAP/REFUND_WINDOW/REVIEW_CHANGED；400 VALIDATION；429 RATE_LIMIT。

影评响应包含 revision。作者编辑及管理员审核都会递增版本；审核以 id + revision 条件更新，版本变化返回 409，前端刷新内容后重新审核。
