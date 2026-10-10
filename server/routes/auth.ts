import { Hono } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { users } from '../db/schema';
import { verifyPassword } from '../auth/password';
import { createToken } from '../auth/jwt';
import { SESSION_COOKIE, requireAuth, type AppEnv } from '../auth/middleware';
import { env } from '../env';

export const authRoutes = new Hono<AppEnv>();

authRoutes.post('/login', async (c) => {
  const body = (await c.req.json().catch(() => null)) as
    | { username?: unknown; password?: unknown }
    | null;

  const username = body?.username;
  const password = body?.password;
  if (typeof username !== 'string' || typeof password !== 'string') {
    return c.json({ ok: false, error: { code: 'VALIDATION', message: '请输入账号和密码' } }, 400);
  }

  const user = db.select().from(users).where(eq(users.username, username)).get();
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: '账号或密码错误' } }, 401);
  }

  const token = await createToken({ id: user.id, username: user.username, role: user.role });
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    // 仅当对外地址是 https 时才加 Secure，避免用 http 直连时登录失效
    secure: env.publicBaseUrl.startsWith('https://'),
  });

  return c.json({ ok: true, data: { id: user.id, username: user.username, role: user.role } });
});

authRoutes.post('/logout', (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ ok: true, data: true });
});

authRoutes.get('/me', requireAuth, (c) => {
  const { id, username, role } = c.get('user');
  return c.json({ ok: true, data: { id, username, role } });
});
