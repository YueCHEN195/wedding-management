import { Hono } from 'hono';
import { and, desc, eq, like, or } from 'drizzle-orm';
import { db } from '../db/client';
import { rsvps } from '../db/schema';
import { requireAdmin, requireAuth, type AppEnv } from '../auth/middleware';
import { rsvpToDTO } from '../lib/dto';
import { now, optionalStr, parsePage, str } from '../lib/util';
import type { Attending } from '../../shared/types';

export const rsvpRoutes = new Hono<AppEnv>();
rsvpRoutes.use('*', requireAuth);

rsvpRoutes.get('/', (c) => {
  const { page, pageSize, offset } = parsePage(c.req.url);
  const url = new URL(c.req.url);
  const keyword = str(url.searchParams.get('keyword'));
  const attending = url.searchParams.get('attending');

  const conds = [];
  if (keyword) conds.push(like(rsvps.guestName, `%${keyword}%`));
  if (attending) conds.push(eq(rsvps.attending, attending as Attending));
  const where = conds.length ? and(...conds) : undefined;

  const all = db.select().from(rsvps).where(where).orderBy(desc(rsvps.submittedAt)).all();
  const items = all.slice(offset, offset + pageSize);

  const summary = { yes: 0, no: 0, maybe: 0, headcountYes: 0, childrenYes: 0, total: all.length };
  for (const r of all) {
    if (r.attending === 'yes') {
      summary.yes++;
      summary.headcountYes += r.headcount;
      summary.childrenYes += r.childrenCount;
    } else if (r.attending === 'no') summary.no++;
    else summary.maybe++;
  }

  return c.json({
    ok: true,
    data: { items: items.map(rsvpToDTO), total: all.length, page, pageSize, summary },
  });
});

rsvpRoutes.patch('/:id', requireAdmin, async (c) => {
  const id = Number(c.req.param('id'));
  const existing = db.select().from(rsvps).where(eq(rsvps.id, id)).get();
  if (!existing) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: '回执不存在' } }, 404);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Partial<typeof rsvps.$inferInsert> = { updatedAt: now() };
  if ('attending' in body) patch.attending = str(body.attending) as Attending;
  if ('headcount' in body) patch.headcount = Math.max(0, Number(body.headcount) || 0);
  if ('childrenCount' in body) patch.childrenCount = Math.max(0, Number(body.childrenCount) || 0);
  if ('message' in body) patch.message = optionalStr(body.message);
  const row = db.update(rsvps).set(patch).where(eq(rsvps.id, id)).returning().get();
  return c.json({ ok: true, data: rsvpToDTO(row) });
});
