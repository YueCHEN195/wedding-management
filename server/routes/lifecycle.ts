import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth, type AppEnv } from '../auth/middleware';
import { applyLifecycle, LifecycleError, lifecycleHistory, previewLifecycle } from '../services/lifecycle';

export const lifecycleRoutes = new Hono<AppEnv>();
lifecycleRoutes.use('*', requireAuth, async (c, next) => { c.header('Cache-Control', 'no-store'); await next(); });
lifecycleRoutes.onError((err, c) => {
  if (err instanceof LifecycleError) return c.json({ ok: false, error: { code: err.code, message: err.message } }, err.status);
  throw err;
});
const paramsSchema = z.object({ entity: z.enum(['guest', 'checkin', 'gift']), id: z.coerce.number().int().positive().safe() });
const actionSchema = z.enum(['archive', 'restore', 'reject', 'cancel', 'void']);
const requestSchema = z.object({ action: actionSchema, reason: z.string().trim().min(1).max(200), token: z.string().regex(/^[a-f0-9]{64}$/) });
function params(entity: string, id: string) {
  const parsed = paramsSchema.safeParse({ entity, id });
  if (!parsed.success) throw new LifecycleError('VALIDATION', '对象类型或编号无效', 400);
  return parsed.data;
}
lifecycleRoutes.get('/:entity/:id/preview', (c) => {
  const { entity, id } = params(c.req.param('entity'), c.req.param('id'));
  const action = actionSchema.safeParse(c.req.query('action'));
  if (!action.success) throw new LifecycleError('VALIDATION', '操作类型无效', 400);
  return c.json({ ok: true, data: previewLifecycle(entity, id, action.data, c.get('user')) });
});
lifecycleRoutes.get('/:entity/:id/history', (c) => {
  const { entity, id } = params(c.req.param('entity'), c.req.param('id'));
  return c.json({ ok: true, data: lifecycleHistory(entity, id, c.get('user')) });
});
lifecycleRoutes.post('/:entity/:id', async (c) => {
  const { entity, id } = params(c.req.param('entity'), c.req.param('id'));
  const parsed = requestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw new LifecycleError('VALIDATION', '请填写操作原因（1–200字），并重新核对影响范围', 400);
  const { action, reason, token } = parsed.data;
  return c.json({ ok: true, data: applyLifecycle(entity, id, action, reason, token, c.get('user')) });
});
