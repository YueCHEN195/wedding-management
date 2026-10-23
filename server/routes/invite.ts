import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { createHash, randomBytes } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db, sqlite } from '../db/client';
import { guests, rsvps } from '../db/schema';
import { rsvpToDTO } from '../lib/dto';
import { now } from '../lib/util';
import { allow, clientIp } from '../lib/rateLimit';
import type { Attending } from '../../shared/types';
import { inputErrorHandler, normalizedRsvp, parseInput, rsvpInputSchema, universalRsvpSchema, RSVP_INPUT_MESSAGE } from '../lib/validation';
import { env } from '../env';

export const inviteRoutes = new Hono();
inviteRoutes.onError(inputErrorHandler);
inviteRoutes.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  await next();
});

const UNIVERSAL_COOKIE = 'wedding_rsvp_edit';
const isCredential = (value: string | undefined): value is string => !!value && /^[a-f0-9]{64}$/.test(value);
const credentialHash = (value: string) => createHash('sha256').update(value).digest('hex');

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
          updatedAt: Math.max(ts, existing.updatedAt + 1),
        })
        .where(eq(rsvps.id, existing.id))
        .run();
      db.update(guests).set({ status: 'rsvp', updatedAt: sql`max(${guests.updatedAt} + 1, ${ts})` }).where(eq(guests.id, opts.guestId)).run();
      return rsvpToDTO(db.select().from(rsvps).where(eq(rsvps.id, existing.id)).get()!);
    }
    db.update(guests).set({ status: 'rsvp', updatedAt: sql`max(${guests.updatedAt} + 1, ${ts})` }).where(eq(guests.id, opts.guestId)).run();
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

/** 准备私有修改凭证并恢复本浏览器的通用回执，绝不按姓名找回。 */
inviteRoutes.get('/rsvp', (c) => {
  const previous = getCookie(c, UNIVERSAL_COOKIE);
  const token = isCredential(previous) ? previous : randomBytes(32).toString('hex');
  if (token !== previous) {
    setCookie(c, UNIVERSAL_COOKIE, token, {
      httpOnly: true,
      sameSite: 'Lax',
      secure: env.publicBaseUrl.startsWith('https://'),
      path: '/api/invite',
      maxAge: 60 * 60 * 24 * 180,
    });
  }
  const row = db.select().from(rsvps)
    .where(and(eq(rsvps.editTokenHash, credentialHash(token)), eq(rsvps.source, 'universal'))).get();
  return c.json({ ok: true, data: row ? rsvpToDTO(row) : null });
});

/** 通用链接只创建/修改持有私有凭证的回执，不关联同名名单。 */
inviteRoutes.post('/rsvp', async (c) => {
  if (!allow(`invite-rsvp:${clientIp(c)}`, 30, 60_000)) {
    return c.json({ ok: false, error: { code: 'RATE_LIMITED', message: '提交过于频繁，请稍后再试' } }, 429);
  }
  const token = getCookie(c, UNIVERSAL_COOKIE);
  if (!isCredential(token)) {
    return c.json({ ok: false, error: { code: 'RSVP_SESSION_REQUIRED', message: '未能读取本浏览器的回执凭证，请允许Cookie并刷新页面后重试' } }, 409);
  }
  const body = parseInput(universalRsvpSchema, await c.req.json().catch(() => null), RSVP_INPUT_MESSAGE + '，姓名1–50字');
  const hash = credentialHash(token);
  const data = db.transaction((tx) => {
    const existing = tx.select().from(rsvps)
      .where(and(eq(rsvps.editTokenHash, hash), eq(rsvps.source, 'universal'))).get();
    const ts = now();
    const values = {
      guestName: body.name,
      attending: body.attending,
      headcount: body.attending === 'yes' ? body.headcount : 0,
      childrenCount: body.attending === 'yes' ? body.childrenCount : 0,
      message: body.message || null,
      updatedAt: existing ? Math.max(ts, existing.updatedAt + 1) : ts,
    };
    const row = existing
      ? tx.update(rsvps).set(values).where(eq(rsvps.id, existing.id)).returning().get()!
      : tx.insert(rsvps).values({ ...values, guestId: null, source: 'universal', submittedAt: ts, editTokenHash: hash }).returning().get();
    return rsvpToDTO(row);
  });
  return c.json({ ok: true, data });
});

/** 专属请柬数据（顺带标记已查看） */
inviteRoutes.get('/:token', (c) => {
  const token = c.req.param('token');
  const guest = db.select().from(guests).where(eq(guests.inviteToken, token)).get();
  if (!guest || guest.archivedAt != null) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: '请柬链接已停用或无效，请联系新人' } }, 404);
  if (guest.status === 'pending' || guest.status === 'sent') {
    db.update(guests)
      .set({ status: 'viewed', viewedAt: guest.viewedAt ?? now(), updatedAt: Math.max(now(), guest.updatedAt + 1) })
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
  // 请求体可能缓慢到达，读取完成后才在写事务内重新核对当前宾客。
  const body = normalizedRsvp(parseInput(rsvpInputSchema, await c.req.json().catch(() => null), RSVP_INPUT_MESSAGE));
  const data = sqlite.transaction(() => {
    const guest = db.select().from(guests).where(eq(guests.inviteToken, token)).get();
    if (!guest || guest.archivedAt != null) return null;
    return submitRsvp({
      guestId: guest.id,
      guestName: guest.name,
      ...body,
      source: 'link',
    });
  }).immediate();
  if (!data) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: '请柬链接已停用或无效，请联系新人' } }, 404);
  return c.json({ ok: true, data });
});
