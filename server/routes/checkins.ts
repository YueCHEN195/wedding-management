import { Hono } from 'hono';
import { and, desc, eq, like } from 'drizzle-orm';
import { db } from '../db/client';
import { checkins, gifts } from '../db/schema';
import { requireAuth, type AppEnv } from '../auth/middleware';
import { checkinToDTO } from '../lib/dto';
import { now, optionalStr, parsePage, str } from '../lib/util';
import { matchOrCreateGuest } from '../lib/guest';
import type { CheckinStatus, GiftMethod } from '../../shared/types';

export const checkinRoutes = new Hono<AppEnv>();
checkinRoutes.use('*', requireAuth);

/** 列表（管理员 / 工作人员） */
checkinRoutes.get('/', (c) => {
  const { page, pageSize, offset } = parsePage(c.req.url);
  const url = new URL(c.req.url);
  const status = url.searchParams.get('status');
  const keyword = str(url.searchParams.get('keyword'));

  const conds = [];
  if (status) conds.push(eq(checkins.status, status as CheckinStatus));
  if (keyword) conds.push(like(checkins.guestName, `%${keyword}%`));
  const where = conds.length ? and(...conds) : undefined;

  const all = db.select().from(checkins).where(where).orderBy(desc(checkins.submittedAt)).all();
  const items = all.slice(offset, offset + pageSize);
  const giftByCheckin = new Map<number, typeof gifts.$inferSelect>();
  for (const g of db.select().from(gifts).all()) {
    if (g.checkinId != null) giftByCheckin.set(g.checkinId, g);
  }

  return c.json({
    ok: true,
    data: {
      items: items.map((r) => checkinToDTO(r, giftByCheckin.get(r.id) ?? null)),
      total: all.length,
      page,
      pageSize,
    },
  });
});

/** 待审核列表（供现场审核页轮询） */
checkinRoutes.get('/pending', (c) => {
  const all = db
    .select()
    .from(checkins)
    .where(eq(checkins.status, 'pending'))
    .orderBy(desc(checkins.submittedAt))
    .all();
  return c.json({ ok: true, data: all.map((r) => checkinToDTO(r)) });
});

/** 手动补录签到（可同时记礼金） */
checkinRoutes.post('/', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = str(body.guestName);
  if (!name) return c.json({ ok: false, error: { code: 'VALIDATION', message: '姓名必填' } }, 400);
  const amount = Number(body.amount ?? 0); // 分
  const method = (optionalStr(body.method) as GiftMethod | null) ?? 'cash';
  const note = optionalStr(body.note);
  const matched = matchOrCreateGuest(name, body.guestId != null ? Number(body.guestId) : null);
  const ts = now();
  const checkin = db
    .insert(checkins)
    .values({
      guestId: matched.id,
      guestName: matched.name,
      source: 'manual',
      status: 'confirmed',
      note,
      submittedAt: ts,
      confirmedAt: ts,
    })
    .returning()
    .get();
  if (Number.isFinite(amount) && amount > 0) {
    db.insert(gifts)
      .values({ guestId: matched.id, guestName: matched.name, amount, method, note, checkinId: checkin.id, recordedAt: ts })
      .run();
  }
  return c.json({ ok: true, data: checkinToDTO(checkin) });
});

/** 审核确认：写入签到状态并（金额 > 0 时）生成礼金 */
checkinRoutes.patch('/:id/confirm', async (c) => {
  const id = Number(c.req.param('id'));
  const existing = db.select().from(checkins).where(eq(checkins.id, id)).get();
  if (!existing) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: '提交不存在' } }, 404);
  if (existing.status === 'confirmed') {
    return c.json({ ok: false, error: { code: 'CONFLICT', message: '该提交已被确认' } }, 409);
  }
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const amount = Number(body.amount); // 分，必填，可为 0
  if (!Number.isFinite(amount) || amount < 0) {
    return c.json({ ok: false, error: { code: 'VALIDATION', message: '请填写礼金金额（可为 0）' } }, 400);
  }
  const method = (optionalStr(body.method) as GiftMethod | null) ?? 'cash';
  const note = optionalStr(body.note);

  const matched = existing.guestId ? { id: existing.guestId, name: existing.guestName } : matchOrCreateGuest(existing.guestName);
  const ts = now();

  db.update(checkins)
    .set({ status: 'confirmed', confirmedAt: ts, guestId: matched.id, guestName: matched.name })
    .where(eq(checkins.id, id))
    .run();
  if (amount > 0) {
    db.insert(gifts)
      .values({ guestId: matched.id, guestName: matched.name, amount, method, note, checkinId: id, recordedAt: ts })
      .run();
  }
  const row = db.select().from(checkins).where(eq(checkins.id, id)).get()!;
  const gift = db.select().from(gifts).where(eq(gifts.checkinId, id)).get();
  return c.json({ ok: true, data: checkinToDTO(row, gift ?? null) });
});

/** 驳回（= 直接删除，含关联礼金） */
checkinRoutes.delete('/:id', (c) => {
  const id = Number(c.req.param('id'));
  const existing = db.select().from(checkins).where(eq(checkins.id, id)).get();
  if (!existing) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: '提交不存在' } }, 404);
  db.delete(gifts).where(eq(gifts.checkinId, id)).run();
  db.delete(checkins).where(eq(checkins.id, id)).run();
  return c.json({ ok: true, data: true });
});
