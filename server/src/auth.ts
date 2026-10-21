import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Router, type RequestHandler, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { User } from '../../shared/domain.ts';
import { emailSchema, loginSchema, passwordSchema, registerSchema } from '../../shared/validation.ts';
import { config } from './config.ts';
import { db } from './db.ts';
import { assert } from './errors.ts';

interface Auth {
  user: User;
  csrfToken: string;
  tokenHash: string;
}
declare module 'express-serve-static-core' {
  interface Request {
    auth?: Auth;
  }
}
interface UserRow {
  id: number;
  email: string;
  display_name: string;
  role: User['role'];
  genres_json: string;
  password_hash: string;
}
const scrypt = promisify(scryptCallback);
const cookieName = config.production ? '__Host-frameharbor' : 'frameharbor';
const sessionMs = 7 * 86400000;
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
const userDTO = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  displayName: row.display_name,
  role: row.role,
  genres: JSON.parse(row.genres_json) as User['genres'],
});

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${key.toString('hex')}`;
}
async function verifyPassword(password: string, stored?: string) {
  const [, salt, key] = (stored ?? 'scrypt$00000000000000000000000000000000$' + '00'.repeat(64)).split('$');
  const actual = (await scrypt(password, salt!, 64)) as Buffer;
  const expected = Buffer.from(key!, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected) && !!stored;
}
function createSession(res: Response, row: UserRow) {
  const token = randomBytes(32).toString('base64url');
  const csrfToken = randomBytes(24).toString('hex');
  db.run(
    'INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES(?,?,?,?)',
    digest(token),
    row.id,
    csrfToken,
    Date.now() + sessionMs,
  );
  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: config.production,
    sameSite: 'lax',
    path: '/',
    maxAge: sessionMs,
  });
  return { user: userDTO(row), csrfToken };
}

export const loadAuth: RequestHandler = (req, _res, next) => {
  db.run('DELETE FROM sessions WHERE expires_at <= ?', Date.now());
  const token = req.headers.cookie
    ?.split(';')
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
  if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) {
    const row = db.get<UserRow & { csrf_token: string }>(
      `SELECT u.*,s.csrf_token FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`,
      digest(token),
      Date.now(),
    );
    if (row) req.auth = { user: userDTO(row), csrfToken: row.csrf_token, tokenHash: digest(token) };
  }
  next();
};
export const protectWrites: RequestHandler = (req, _res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }
  const origin = req.get('origin');
  assert(!origin || origin === config.origin, 403, 'ORIGIN', '请求来源不受信任');
  assert(req.get('X-FrameHarbor-Request') === '1', 403, 'REQUEST_HEADER', '请求缺少安全标记');
  assert(req.is('application/json'), 415, 'CONTENT_TYPE', '请使用 JSON 请求');
  if (req.auth)
    assert(req.get('X-CSRF-Token') === req.auth.csrfToken, 403, 'CSRF', '页面会话已更新，请刷新后重试');
  next();
};
export const requireAuth: RequestHandler = (req, _res, next) => {
  assert(req.auth, 401, 'AUTH_REQUIRED', '请先登录');
  next();
};
export const requireAdmin: RequestHandler = (req, _res, next) => {
  assert(req.auth, 401, 'AUTH_REQUIRED', '请先登录');
  assert(req.auth.user.role === 'admin', 403, 'ADMIN_REQUIRED', '此操作需要运营权限');
  next();
};
const authLimit = rateLimit({
  windowMs: 15 * 60000,
  limit: 15,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMIT', message: '尝试过于频繁，请 15 分钟后再试' } },
});
const registerLimit = rateLimit({
  windowMs: 3600000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMIT', message: '注册过于频繁，请稍后再试' } },
});
export const authRouter = Router();
authRouter.get('/me', (req, res) =>
  res.json({ data: { user: req.auth?.user ?? null, csrfToken: req.auth?.csrfToken ?? null } }),
);
authRouter.post('/register', registerLimit, async (req, res) => {
  const input = registerSchema.parse(req.body);
  assert(!db.get('SELECT id FROM users WHERE email=?', input.email), 409, 'EMAIL_EXISTS', '该邮箱已注册');
  const passwordHash = await hashPassword(input.password);
  // scrypt awaits: repeat the uniqueness check inside the synchronous write transaction.
  const row = db.transaction(() => {
    assert(!db.get('SELECT id FROM users WHERE email=?', input.email), 409, 'EMAIL_EXISTS', '该邮箱已注册');
    const result = db.run(
      'INSERT INTO users(email,display_name,password_hash,created_at) VALUES(?,?,?,?)',
      input.email,
      input.displayName,
      passwordHash,
      Date.now(),
    );
    return db.get<UserRow>('SELECT * FROM users WHERE id=?', Number(result.lastInsertRowid))!;
  });
  if (req.auth) db.run('DELETE FROM sessions WHERE token_hash=?', req.auth.tokenHash);
  res.status(201).json({ data: createSession(res, row) });
});
authRouter.post('/login', authLimit, async (req, res) => {
  const input = loginSchema.parse(req.body);
  const row = db.get<UserRow>('SELECT * FROM users WHERE email=?', input.email);
  assert(await verifyPassword(input.password, row?.password_hash), 401, 'BAD_CREDENTIALS', '邮箱或密码有误');
  if (req.auth) db.run('DELETE FROM sessions WHERE token_hash=?', req.auth.tokenHash);
  res.json({ data: createSession(res, row!) });
});
authRouter.post('/logout', requireAuth, (req, res) => {
  db.run('DELETE FROM sessions WHERE token_hash=?', req.auth!.tokenHash);
  res.clearCookie(cookieName, { httpOnly: true, secure: config.production, sameSite: 'lax', path: '/' });
  res.json({ data: { ok: true } });
});

export async function bootstrapAdmin() {
  if (!config.ADMIN_PASSWORD) {
    console.info('未配置 ADMIN_PASSWORD，跳过管理员创建。');
    return;
  }
  const email = emailSchema.parse(config.ADMIN_EMAIL);
  passwordSchema.parse(config.ADMIN_PASSWORD);
  const existing = db.get<UserRow>('SELECT * FROM users WHERE email=?', email);
  assert(
    !existing || existing.role === 'admin',
    409,
    'ADMIN_EMAIL_IN_USE',
    '管理员邮箱已被普通用户占用，请配置其他邮箱',
  );
  if (existing) return;
  const passwordHash = await hashPassword(config.ADMIN_PASSWORD);
  db.run(
    "INSERT INTO users(email,display_name,password_hash,role,created_at) VALUES(?,?,?,'admin',?)",
    email,
    config.ADMIN_NAME,
    passwordHash,
    Date.now(),
  );
  console.info('管理员已从环境配置创建。');
}
