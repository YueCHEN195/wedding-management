import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { requireAuth, type AppEnv } from '../auth/middleware';
import { subscribeChanges } from '../services/realtime';
export const eventRoutes = new Hono<AppEnv>();
eventRoutes.get('/', requireAuth, (c) => {
  c.header('X-Accel-Buffering', 'no');
  const expiresAt = c.get('user').exp * 1000;
  return streamSSE(c, async (stream) => {
    let changed = false;
    let wake: (() => void) | undefined;
    const unsubscribe = subscribeChanges(() => {
      changed = true;
      wake?.();
    });
    stream.onAbort(() => wake?.());
    try {
      await stream.writeSSE({ event: 'ready', data: '{}', retry: 2000 });
      while (!stream.aborted && Date.now() < expiresAt) {
        if (!changed)
          await new Promise<void>((resolve) => {
            const timer = setTimeout(done, Math.min(20000, Math.max(1, expiresAt - Date.now())));
            function done() {
              clearTimeout(timer);
              wake = undefined;
              resolve();
            }
            wake = done;
            if (stream.aborted || changed) done();
          });
        if (stream.aborted || Date.now() >= expiresAt) break;
        const event = changed ? 'change' : 'heartbeat';
        changed = false;
        await stream.writeSSE({ event, data: '{}' });
      }
    } finally {
      unsubscribe();
      wake?.();
    }
  });
});
