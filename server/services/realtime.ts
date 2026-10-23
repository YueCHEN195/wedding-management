import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../auth/middleware';
const listeners = new Set<() => void>();
export function subscribeChanges(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function publishChange() {
  for (const listener of listeners) listener();
}
/** Publish only after a successful business write and transaction commit. */
export const notifyBusinessWrites = createMiddleware<AppEnv>(async (c, next) => {
  await next();
  if (
    ['POST', 'PATCH', 'DELETE'].includes(c.req.method) &&
    c.res.ok &&
    !c.req.path.startsWith('/api/auth/')
  )
    publishChange();
});
