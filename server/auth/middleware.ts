import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import { verifyToken, type SessionPayload } from './jwt';

export const SESSION_COOKIE = 'wedding_session';

export type AppEnv = {
  Variables: {
    user: SessionPayload;
  };
};

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) {
    return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } }, 401);
  }
  const payload = await verifyToken(token);
  if (!payload) {
    return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: '登录已过期，请重新登录' } }, 401);
  }
  c.set('user', payload);
  await next();
});

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get('user');
  if (user.role !== 'admin') {
    return c.json({ ok: false, error: { code: 'FORBIDDEN', message: '无权限' } }, 403);
  }
  await next();
});
