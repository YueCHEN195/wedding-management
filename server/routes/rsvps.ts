import { Hono } from 'hono';
import { and, desc, eq, like, sql } from 'drizzle-orm';
import { db, sqlite } from '../db/client';
import { guests, rsvps } from '../db/schema';
import { requireAdmin, requireAuth, type AppEnv } from '../auth/middleware';
import { rsvpToDTO } from '../lib/dto';
import { now, parsePage, str } from '../lib/util';
import { enumQuery, inputErrorHandler, normalizedRsvp, parseId, parseInput, rsvpInputSchema, rsvpPatchSchema, RSVP_INPUT_MESSAGE, WriteConflictError } from '../lib/validation';

export const rsvpRoutes = new Hono<AppEnv>();
rsvpRoutes.use('*', requireAuth);
rsvpRoutes.onError(inputErrorHandler);

rsvpRoutes.get('/', requireAdmin, (c) => {
  const { page, pageSize, offset } = parsePage(c.req.url);
  const url = new URL(c.req.url);
  const keyword = str(url.searchParams.get('keyword'));
  const attending = enumQuery(url.searchParams.get('attending'), ['yes', 'no', 'maybe'] as const);

  const conds = [];
  if (keyword) conds.push(like(rsvps.guestName, `%${keyword}%`));
  if (attending) conds.push(eq(rsvps.attending, attending));
  const where = conds.length ? and(...conds) : undefined;

  const all = db.select().from(rsvps).where(where).orderBy(desc(rsvps.submittedAt)).all();
  const items = all.slice(offset, offset + pageSize);

  const archivedIds = new Set(db.select().from(guests).all().filter((g) => g.archivedAt != null).map((g) => g.id));
  const active = all.filter((r) => r.guestId == null || !archivedIds.has(r.guestId));
  const summary = { yes: 0, no: 0, maybe: 0, headcountYes: 0, childrenYes: 0, total: active.length };
  for (const r of active) {
    if (r.attending === 'yes') {
      summary.yes++;
      summary.headcountYes += r.headcount;
      summary.childrenYes += r.childrenCount;
    } else if (r.attending === 'no') summary.no++;
    else summary.maybe++;
  }

  return c.json({
    ok: true,
    data: { items: items.map((r) => ({ ...rsvpToDTO(r), guestArchived: r.guestId != null && archivedIds.has(r.guestId) })), total: all.length, page, pageSize, summary },
  });
});

rsvpRoutes.get('/:id', requireAdmin, (c) => {
  const row = db.select().from(rsvps).where(eq(rsvps.id, parseId(c.req.param('id')))).get();
  if (!row) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: '回执不存在' } }, 404);
  const guestArchived = row.guestId != null && db.select().from(guests).where(eq(guests.id, row.guestId)).get()?.archivedAt != null;
  c.header('Cache-Control', 'no-store');
  return c.json({ ok: true, data: { ...rsvpToDTO(row), guestArchived } });
});

rsvpRoutes.patch('/:id', requireAdmin, async (c) => {
  const id = parseId(c.req.param('id'));
  const body = parseInput(rsvpPatchSchema, await c.req.json().catch(() => null), RSVP_INPUT_MESSAGE);
  const row = sqlite.transaction(() => {
    const existing = db.select().from(rsvps).where(eq(rsvps.id, id)).get();
    if (!existing) return null;
    if (existing.guestId != null && db.select().from(guests).where(eq(guests.id, existing.guestId)).get()?.archivedAt != null) return null;
    if (c.req.header('If-Match') !== String(existing.updatedAt))
      throw new WriteConflictError('回执已更新或缺少原版本，请载入最新内容后重新核对；当前修改未保存');
    const values = normalizedRsvp(parseInput(rsvpInputSchema, {
      attending: existing.attending, headcount: existing.headcount, childrenCount: existing.childrenCount, message: existing.message, ...body,
    }, RSVP_INPUT_MESSAGE));
    const patch = { ...values, updatedAt: Math.max(now(), existing.updatedAt + 1) };
    const updated = db.update(rsvps).set(patch).where(eq(rsvps.id, id)).returning().get();
    if (existing.guestId != null) {
      db.update(guests).set({ status: 'rsvp', updatedAt: sql`max(${guests.updatedAt} + 1, ${patch.updatedAt})` }).where(eq(guests.id, existing.guestId)).run();
    }
    return updated;
  }).immediate();
  if (!row) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: '回执不存在或宾客已归档，请先恢复宾客' } }, 404);
  return c.json({ ok: true, data: rsvpToDTO(row) });
});
