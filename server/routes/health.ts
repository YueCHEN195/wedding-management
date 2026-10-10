import { Hono } from 'hono';

export const healthRoutes = new Hono();

healthRoutes.get('/', (c) => c.json({ ok: true, data: { status: 'ok', time: Date.now() } }));
