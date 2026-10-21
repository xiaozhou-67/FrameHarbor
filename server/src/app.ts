import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.ts';
import { authRouter, loadAuth, protectWrites } from './auth.ts';
import { adminRouter } from './admin.ts';
import { catalogRouter } from './catalog.ts';
import { communityRouter } from './community.ts';
import { ticketingRouter } from './ticketing.ts';
import { errorHandler } from './errors.ts';

export function createApp() {
  const app = express();
  // Only trust configured proxy addresses/subnets, never arbitrary forwarded headers.
  app.set('trust proxy', config.trustedProxies);
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: config.production ? [] : null,
        },
      },
      strictTransportSecurity: config.production ? undefined : false,
    }),
  );
  app.use(
    '/api',
    rateLimit({
      windowMs: 5 * 60000,
      limit: 500,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: { code: 'RATE_LIMIT', message: '请求过于频繁，请稍后再试' } },
    }),
  );
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', express.json({ limit: '64kb' }), loadAuth, protectWrites);
  app.get('/api/health', (_req, res) => res.json({ data: { status: 'ok', name: 'FrameHarbor' } }));
  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api', catalogRouter, communityRouter, ticketingRouter);
  app.use('/api', (_req, res) =>
    res.status(404).json({ error: { code: 'NOT_FOUND', message: '接口不存在' } }),
  );
  const webRoot = fileURLToPath(new URL('../../dist/web/', import.meta.url));
  if (existsSync(webRoot)) {
    app.use(express.static(webRoot, { index: false, maxAge: '1h' }));
    app.get('/{*path}', (req, res) => {
      if (!req.accepts('html') || /\.[a-z0-9]+$/i.test(req.path)) {
        res.status(404).end();
        return;
      }
      res.set('Cache-Control', 'no-cache').sendFile(`${webRoot}/index.html`);
    });
  }
  app.use(errorHandler);
  return app;
}
