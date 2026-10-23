import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { eventRoutes } from './routes/events';
import { notifyBusinessWrites } from './services/realtime';
import { logger } from 'hono/logger';
import { env } from './env';
import { runMigrations } from './db/migrate';
import { authRoutes } from './routes/auth';
import { healthRoutes } from './routes/health';
import { guestRoutes } from './routes/guests';
import { rsvpRoutes } from './routes/rsvps';
import { checkinRoutes } from './routes/checkins';
import { giftRoutes } from './routes/gifts';
import { statsRoutes } from './routes/stats';
import { exportRoutes } from './routes/export';
import { inviteRoutes } from './routes/invite';
import { lifecycleRoutes } from './routes/lifecycle';
import { publicCheckinRoutes } from './routes/checkin';

// 启动时确保数据库结构最新（失败则直接退出，避免"进程活着但服务不可用"）
try {
  runMigrations();
} catch (err) {
  console.error('[server] 数据库初始化失败：', err instanceof Error ? err.message : err);
  process.exit(1);
}

const app = new Hono();
app.onError((err, c) => {
  console.error('[server] request failed:', err);
  return c.json({ ok: false, error: { code: 'INTERNAL', message: '操作失败，请稍后重试；如反复出现，请联系管理员' } }, 500);
});

app.use('*', logger());
app.use('/api/*', notifyBusinessWrites);
app.route('/api/events', eventRoutes);

app.route('/api/lifecycle', lifecycleRoutes);
app.route('/api/health', healthRoutes);
app.route('/api/auth', authRoutes);
app.route('/api/guests', guestRoutes);
app.route('/api/rsvps', rsvpRoutes);
app.route('/api/checkins', checkinRoutes);
app.route('/api/gifts', giftRoutes);
app.route('/api/stats', statsRoutes);
app.route('/api/export', exportRoutes);
app.route('/api/invite', inviteRoutes);
app.route('/api/checkin', publicCheckinRoutes);

// 未匹配到的 API 统一返回 404 JSON
app.all('/api/*', (c) => c.json({ ok: false, error: { code: 'NOT_FOUND', message: '接口不存在' } }, 404));

// 生产环境由 Node 托管前端构建产物（SPA）
if (env.isProduction) {
  app.use('/*', serveStatic({ root: './web/dist' }));
  app.get('*', serveStatic({ path: './web/dist/index.html' }));
}

const server = serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`[server] listening on http://localhost:${info.port} (${env.nodeEnv})`);
});

// 端口占用等启动错误：打印清晰提示并退出（配合 concurrently -k 会一并停掉前端）
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[server] 启动失败：端口 ${env.port} 已被占用。`);
    console.error('[server] 请关闭占用该端口的进程，或修改 .env 里的 PORT 后重试。');
  } else {
    console.error('[server] 启动失败：', err.message);
  }
  process.exit(1);
});

