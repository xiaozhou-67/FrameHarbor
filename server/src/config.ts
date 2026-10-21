import { resolve } from 'node:path';
import { z } from 'zod';

const env = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    HOST: z.string().default('127.0.0.1'),
    TRUST_PROXY: z.string().trim().max(300).default(''),
    PORT: z.coerce.number().int().min(1).max(65535).default(8787),
    APP_ORIGIN: z.url().optional(),
    DB_PATH: z.string().default('./data/frameharbor.sqlite'),
    DEMO_PAYMENTS: z.enum(['true', 'false']).optional(),
    SEED_DEMO: z.enum(['true', 'false']).default('true'),
    ADMIN_EMAIL: z.string().optional(),
    ADMIN_PASSWORD: z.string().optional(),
    ADMIN_NAME: z.string().default('帧港运营'),
  })
  .parse(process.env);
const production = env.NODE_ENV === 'production';
if (production && (!env.APP_ORIGIN || !env.APP_ORIGIN.startsWith('https://'))) {
  throw new Error('生产环境需要配置 HTTPS APP_ORIGIN');
}
if (production && !env.TRUST_PROXY) {
  throw new Error('生产环境需要配置 TRUST_PROXY 为实际 HTTPS 反代地址，本机反代使用 loopback');
}
export const config = {
  ...env,
  production,
  trustedProxies: env.TRUST_PROXY
    ? env.TRUST_PROXY.split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    : false,
  databasePath: resolve(env.DB_PATH),
  origin: new URL(env.APP_ORIGIN ?? 'http://127.0.0.1:5173').origin,
  demoPayments: env.DEMO_PAYMENTS === 'true' || (!production && env.DEMO_PAYMENTS !== 'false'),
};
