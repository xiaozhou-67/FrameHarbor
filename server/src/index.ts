import { createApp } from './app.ts';
import { bootstrapAdmin } from './auth.ts';
import { config } from './config.ts';
import { db } from './db.ts';
import { seedDemo } from './seed.ts';

await bootstrapAdmin();
seedDemo();
const server = createApp().listen(config.PORT, config.HOST, () => {
  console.info(`FrameHarbor API: http://${config.HOST}:${config.PORT}`);
  console.info(`演示支付：${config.demoPayments ? '开启' : '关闭'}`);
});
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
