PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL, password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
  genres_json TEXT NOT NULL DEFAULT '[]', created_at INTEGER NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL, expires_at INTEGER NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS movies (
  id INTEGER PRIMARY KEY, title TEXT NOT NULL, english_title TEXT NOT NULL, genre TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK(duration_minutes BETWEEN 30 AND 300),
  language TEXT NOT NULL, release_date TEXT NOT NULL, synopsis TEXT NOT NULL,
  director TEXT NOT NULL, cast_json TEXT NOT NULL, poster TEXT NOT NULL, accent TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('now','soon','archived')),
  featured INTEGER NOT NULL DEFAULT 0 CHECK(featured IN (0,1)),
  editorial_score REAL NOT NULL CHECK(editorial_score BETWEEN 0 AND 10)
) STRICT;
CREATE TABLE IF NOT EXISTS cinemas (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, city TEXT NOT NULL, district TEXT NOT NULL,
  address TEXT NOT NULL, tags_json TEXT NOT NULL, description TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS halls (
  id INTEGER PRIMARY KEY, cinema_id INTEGER NOT NULL REFERENCES cinemas(id), name TEXT NOT NULL,
  format TEXT NOT NULL, rows_count INTEGER NOT NULL CHECK(rows_count BETWEEN 4 AND 15),
  columns_count INTEGER NOT NULL CHECK(columns_count BETWEEN 6 AND 20), UNIQUE(cinema_id,name)
) STRICT;
CREATE TABLE IF NOT EXISTS shows (
  id INTEGER PRIMARY KEY, movie_id INTEGER NOT NULL REFERENCES movies(id),
  hall_id INTEGER NOT NULL REFERENCES halls(id), starts_at INTEGER NOT NULL, ends_at INTEGER NOT NULL,
  price_cents INTEGER NOT NULL CHECK(price_cents BETWEEN 100 AND 100000),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','cancelled')), CHECK(ends_at > starts_at)
) STRICT;
CREATE INDEX IF NOT EXISTS idx_shows_hall_time ON shows(hall_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_shows_movie_time ON shows(movie_id, starts_at);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), show_id INTEGER NOT NULL REFERENCES shows(id),
  seats_json TEXT NOT NULL, seat_count INTEGER NOT NULL CHECK(seat_count BETWEEN 1 AND 4),
  subtotal_cents INTEGER NOT NULL CHECK(subtotal_cents > 0), discount_cents INTEGER NOT NULL CHECK(discount_cents >= 0),
  total_cents INTEGER NOT NULL CHECK(total_cents >= 0), coupon_code TEXT,
  status TEXT NOT NULL CHECK(status IN ('pending','paid','cancelled','expired','refunded')),
  expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL, paid_at INTEGER, refunded_at INTEGER,
  ticket_code TEXT UNIQUE, checked_in_at INTEGER,
  CHECK(total_cents = subtotal_cents - discount_cents)
) STRICT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_pending_order ON orders(user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_expiry ON orders(status, expires_at);
CREATE TABLE IF NOT EXISTS seat_claims (
  show_id INTEGER NOT NULL REFERENCES shows(id), seat TEXT NOT NULL,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  PRIMARY KEY(show_id, seat)
) STRICT;
CREATE INDEX IF NOT EXISTS idx_claim_order ON seat_claims(order_id);
CREATE TABLE IF NOT EXISTS coupon_uses (
  user_id INTEGER NOT NULL REFERENCES users(id), coupon_code TEXT NOT NULL,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id), PRIMARY KEY(user_id,coupon_code)
) STRICT;
CREATE TABLE IF NOT EXISTS watchlist (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  movie_id INTEGER NOT NULL REFERENCES movies(id), created_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,movie_id)
) STRICT;
CREATE TABLE IF NOT EXISTS reviews (
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision >= 1),
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), movie_id INTEGER NOT NULL REFERENCES movies(id),
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 10), content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  created_at INTEGER NOT NULL, UNIQUE(user_id,movie_id)
) STRICT;
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status, movie_id);
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY, actor_id INTEGER NOT NULL REFERENCES users(id),
  action TEXT NOT NULL, target TEXT NOT NULL, detail TEXT NOT NULL, created_at INTEGER NOT NULL
) STRICT;
PRAGMA user_version = 1;
