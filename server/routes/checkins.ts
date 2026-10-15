import { Hono } from 'hono';
import { and, desc, eq, like } from 'drizzle-orm';
import { db } from '../db/client';
import { checkins, gifts, guests } from '../db/schema';
import { requireAuth, type AppEnv } from '../auth/middleware';
import { checkinToDTO } from '../lib/dto';
import { parsePage, str } from '../lib/util';
import { findGuestCandidates, GuestMatchError } from '../lib/guest';
import { enumQuery, inputErrorHandler } from '../lib/validation';
import { CheckinError, confirmCheckin, confirmCheckinSchema, createManualCheckin, manualCheckinSchema } from '../services/checkins';

export const checkinRoutes = new Hono<AppEnv>();
checkinRoutes.use('*', requireAuth);
checkinRoutes.onError((err, c) => {
  if (err instanceof GuestMatchError || err instanceof CheckinError) {
    return c.json({ ok: false, error: { code: err.code, message: err.message } }, err.status);
  }
  return inputErrorHandler(err, c);
});

/** 只在登录后的审核端展示同名候选，不向自助签到端公开名单。 */
checkinRoutes.get('/candidates', (c) => {
  const name = str(c.req.query('name'));
  if (!name || name.length > 50) {
    return c.json({ ok: false, error: { code: 'VALIDATION', message: '请填写有效姓名（最多50字）' } }, 400);
  }
  return c.json({ ok: true, data: findGuestCandidates(name) });
});

/** 列表（管理员 / 工作人员） */
checkinRoutes.get('/', (c) => {
  const { page, pageSize, offset } = parsePage(c.req.url);
  const url = new URL(c.req.url);
  const status = enumQuery(url.searchParams.get('status'), ['pending', 'confirmed', 'rejected', 'cancelled'] as const);
  const keyword = str(url.searchParams.get('keyword'));

  const conds = [];
  if (status) conds.push(eq(checkins.status, status));
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
  const candidatesByName = new Map<string, ReturnType<typeof findGuestCandidates>>();
  const data = all.map((r) => {
    if (!candidatesByName.has(r.guestName)) candidatesByName.set(r.guestName, findGuestCandidates(r.guestName));
    const guestCandidates = candidatesByName.get(r.guestName)!;
    return { ...checkinToDTO(r), guestArchived: r.guestId != null && db.select().from(guests).where(eq(guests.id, r.guestId)).get()?.archivedAt != null, guestCandidates, requiresGuestSelection: guestCandidates.length > 1 };
  });
  return c.json({ ok: true, data });
});

/** 手动补录签到（可同时记礼金） */
checkinRoutes.post('/', async (c) => {
  const parsed = manualCheckinSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ ok: false, error: { code: 'VALIDATION', message: '请核对姓名、宾客选择、新宾客辨识分组（1–50字）、金额（0–100000元，最多两位小数）、方式和备注；如页面已打开较久，请刷新后重试' } }, 400);
  const { checkin, gift, duplicate } = createManualCheckin(parsed.data);
  return c.json({ ok: true, data: { ...checkinToDTO(checkin, gift), duplicate } });
});

/** 审核确认：写入签到状态并（金额 > 0 时）生成礼金 */
checkinRoutes.patch('/:id/confirm', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isSafeInteger(id) || id <= 0) return c.json({ ok: false, error: { code: 'VALIDATION', message: '提交编号无效' } }, 400);
  const parsed = confirmCheckinSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ ok: false, error: { code: 'VALIDATION', message: '请核对宾客选择、新宾客辨识分组（1–50字）、金额（0–100000元，最多两位小数）、方式和备注' } }, 400);
  const { checkin, gift } = confirmCheckin(id, parsed.data);
  return c.json({ ok: true, data: checkinToDTO(checkin, gift) });
});

/** 旧物理删除入口关闭，业务操作统一使用 lifecycle。 */
checkinRoutes.delete('/:id', (c) => c.json({ ok: false, error: { code: 'DELETE_DISABLED', message: '不再支持永久删除，请刷新页面使用归档、驳回、撤销或作废，并核对影响范围' } }, 409));
