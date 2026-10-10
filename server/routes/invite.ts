import { Hono } from 'hono';
import { desc, eq, like } from 'drizzle-orm';
import { db } from '../db/client';
import { guests, rsvps } from '../db/schema';
import { rsvpToDTO } from '../lib/dto';
import { now, optionalStr, str } from '../lib/util';
import { allow, clientIp } from '../lib/rateLimit';
import type { Attending } from '../../shared/types';

export const inviteRoutes = new Hono();

function submitRsvp(opts: {
  guestId: number | null;
  guestName: string;
  attending: Attending;
  headcount: number;
  childrenCount: number;
  message: string | null;
  source: 'link' | 'universal';
}) {
  const ts = now();
  if (opts.guestId != null) {
    const existing = db.select().from(rsvps).where(eq(rsvps.guestId, opts.guestId)).orderBy(desc(rsvps.submittedAt)).get();
    if (existing) {
      db.update(rsvps)
        .set({
          guestName: opts.guestName,
          attending: opts.attending,
          headcount: opts.headcount,
          childrenCount: opts.childrenCount,
          message: opts.message,
          updatedAt: ts,
        })
        .where(eq(rsvps.id, existing.id))
        .run();
      db.update(guests).set({ status: 'rsvp', updatedAt: ts }).where(eq(guests.id, opts.guestId)).run();
      return rsvpToDTO(db.select().from(rsvps).where(eq(rsvps.id, existing.id)).get()!);
    }
    db.update(guests).set({ status: 'rsvp', updatedAt: ts }).where(eq(guests.id, opts.guestId)).run();
  }
  const row = db
    .insert(rsvps)
    .values({
      guestId: opts.guestId,
      guestName: opts.guestName,
      attending: opts.attending,
      headcount: opts.headcount,
      childrenCount: opts.childrenCount,
      message: opts.message,
      source: opts.source,
      submittedAt: ts,
      updatedAt: ts,
    })
    .returning()
    .get();
  return rsvpToDTO(row);
}

/** 通用请柬：仅标识这是通用入口 */
inviteRoutes.get('/', (c) => c.json({ ok: true, data: { universal: true } }));

/** 通用链接提交回执（宾客自行输入姓名） */
inviteRoutes.post('/rsvp', async (c) => {
  if (!allow(`invite-rsvp:${clientIp(c)}`, 30, 60_000)) {
    return c.json({ ok: false, error: { code: 'RATE_LIMITED', message: '提交过于频繁，请稍后再试' } }, 429);
  }
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = str(body.name);
  if (!name) return c.json({ ok: false, error: { code: 'VALIDATION', message: '请填写您的姓名' } }, 400);
  const matches = db.select().from(guests).where(like(guests.name, name)).all();
  const exact = matches.filter((g) => g.name === name);
  const guestId = exact.length === 1 ? exact[0].id : null;
  const data = submitRsvp({
    guestId,
    guestName: name,
    attending: (str(body.attending) || 'maybe') as Attending,
    headcount: Math.max(1, Number(body.headcount) || 1),
    childrenCount: Math.max(0, Number(body.childrenCount) || 0),
    message: optionalStr(body.message),
    source: 'universal',
  });
  return c.json({ ok: true, data });
});

/** 专属请柬数据（顺带标记已查看） */
inviteRoutes.get('/:token', (c) => {
  const token = c.req.param('token');
  const guest = db.select().from(guests).where(eq(guests.inviteToken, token)).get();
  if (!guest) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: '请柬链接无效' } }, 404);
  if (guest.status === 'pending' || guest.status === 'sent') {
    db.update(guests)
      .set({ status: 'viewed', viewedAt: guest.viewedAt ?? now(), updatedAt: now() })
      .where(eq(guests.id, guest.id))
      .run();
  }
  const rsvp = db.select().from(rsvps).where(eq(rsvps.guestId, guest.id)).orderBy(desc(rsvps.submittedAt)).get();
  return c.json({
    ok: true,
    data: { guestName: guest.name, salutation: guest.salutation, rsvp: rsvp ? rsvpToDTO(rsvp) : null },
  });
});

/** 专属请柬提交回执（可覆盖） */
inviteRoutes.post('/:token/rsvp', async (c) => {
  if (!allow(`invite-rsvp:${clientIp(c)}`, 30, 60_000)) {
    return c.json({ ok: false, error: { code: 'RATE_LIMITED', message: '提交过于频繁，请稍后再试' } }, 429);
  }
  const token = c.req.param('token');
  const guest = db.select().from(guests).where(eq(guests.inviteToken, token)).get();
  if (!guest) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: '请柬链接无效' } }, 404);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const attending = (str(body.attending) || 'maybe') as Attending;
  const data = submitRsvp({
    guestId: guest.id,
    guestName: guest.name,
    attending,
    headcount: attending === 'yes' ? Math.max(1, Number(body.headcount) || 1) : Number(body.headcount) || 0,
    childrenCount: Math.max(0, Number(body.childrenCount) || 0),
    message: optionalStr(body.message),
    source: 'link',
  });
  return c.json({ ok: true, data });
});
