import { Hono } from 'hono';
import { z } from 'zod';
import { previewCheckinReassignment, reassignCheckin } from '../services/checkinReassignment';
import { LifecycleError } from '../services/lifecycle';
import { createGift, GiftEditError } from '../services/gifts';
import { and, asc, desc, eq, like } from 'drizzle-orm';
import { db } from '../db/client';
import { checkins, gifts, guests } from '../db/schema';
import { requireAuth, type AppEnv } from '../auth/middleware';
import { checkinToDTO, giftToDTO } from '../lib/dto';
import { parsePage, str } from '../lib/util';
import { findGuestCandidates, GuestMatchError } from '../lib/guest';
import { enumQuery, giftCreateSchema, parseInput, inputErrorHandler, parseId } from '../lib/validation';
import { attendanceCorrectionSchema, correctAttendance, CheckinError, confirmCheckin, confirmCheckinSchema, createManualCheckin, manualCheckinSchema } from '../services/checkins';

export const checkinRoutes = new Hono<AppEnv>();
checkinRoutes.use('*', requireAuth);
checkinRoutes.onError((err, c) => {
  if (err instanceof GuestMatchError || err instanceof CheckinError || err instanceof LifecycleError || err instanceof GiftEditError) {
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
  const giftByCheckin = new Map<number, (typeof gifts.$inferSelect)[]>();
  for (const g of db.select().from(gifts).all()) {
    if (g.checkinId != null) giftByCheckin.set(g.checkinId, [...(giftByCheckin.get(g.checkinId) ?? []), g]);
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
    .orderBy(asc(checkins.submittedAt), asc(checkins.id))
    .all();
  const candidatesByName = new Map<string, ReturnType<typeof findGuestCandidates>>();
  const data = all.map((r) => {
    const linkedGuest = r.guestId == null ? undefined : db.select().from(guests).where(eq(guests.id, r.guestId)).get();
    const guestName = linkedGuest?.name ?? r.guestName;
    if (!candidatesByName.has(guestName)) candidatesByName.set(guestName, findGuestCandidates(guestName));
    const guestCandidates = candidatesByName.get(guestName)!;
    return { ...checkinToDTO(r), guestName, guestArchived: linkedGuest?.archivedAt != null, guestCandidates, requiresGuestSelection: guestCandidates.length > 1 };
  });
  return c.json({ ok: true, data });
});

/** 手动补录签到（可同时记礼金） */
checkinRoutes.post('/', async (c) => {
  const parsed = manualCheckinSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ ok: false, error: { code: 'VALIDATION', message: '请核对实际总人数（1–20人）、儿童人数（0至总人数）、姓名、宾客选择、金额（0–100000元，最多两位小数）、方式和备注；如页面已打开较久，请刷新后重试' } }, 400);
  const { checkin, gift, duplicate } = createManualCheckin(parsed.data, c.get('user'));
  return c.json({ ok: true, data: { ...checkinToDTO(checkin, gift), duplicate } });
});

/** 审核确认：写入签到状态并（金额 > 0 时）生成礼金 */
checkinRoutes.patch('/:id/confirm', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isSafeInteger(id) || id <= 0) return c.json({ ok: false, error: { code: 'VALIDATION', message: '提交编号无效' } }, 400);
  const parsed = confirmCheckinSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ ok: false, error: { code: 'VALIDATION', message: '请核对实际总人数（1–20人）、儿童人数（0至总人数）、宾客选择、金额（0–100000元，最多两位小数）、方式和备注' } }, 400);
  const { checkin, gift } = confirmCheckin(id, parsed.data, c.get('user'));
  return c.json({ ok: true, data: checkinToDTO(checkin, gift) });
});

/** 管理员和工作人员补记或更正实际人数，原值与原因一并留痕。 */
checkinRoutes.patch('/:id/attendance', async (c) => {
  const id = parseId(c.req.param('id'));
  const parsed = attendanceCorrectionSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ ok: false, error: { code: 'VALIDATION', message: '请填写实际总人数（1–20人）、儿童人数（0至总人数）及更正原因，并刷新核对原人数' } }, 400);
  return c.json({ ok: true, data: checkinToDTO(correctAttendance(id, parsed.data, c.get('user'))) });
});

/** 旧物理删除入口关闭，业务操作统一使用 lifecycle。 */
checkinRoutes.delete('/:id', (c) => c.json({ ok: false, error: { code: 'DELETE_DISABLED', message: '不再支持永久删除，请刷新页面使用归档、驳回、撤销或作废，并核对影响范围' } }, 409));

/** 现场补送礼金：只关联本次有效签到，沿用独立记账幂等及审计。 */
checkinRoutes.post('/:id/gifts', async (c) => {
  const input = parseInput(giftCreateSchema, await c.req.json().catch(() => null), '请核对宾客、实收礼金与提交标识');
  return c.json({ ok: true, data: giftToDTO(createGift(input, c.get('user'), parseId(c.req.param('id')))) });
});
const reassignmentSchema = z.object({ guestId: z.number().int().positive().safe(), token: z.string().regex(/^[a-f0-9]{64}$/), reason: z.string().trim().min(1).max(200) }).strict();
checkinRoutes.get('/:id/reassignment', (c) => c.json({ ok: true, data: previewCheckinReassignment(parseId(c.req.param('id')), parseId(c.req.query('guestId') ?? '')) }));
checkinRoutes.patch('/:id/reassignment', async (c) => {
  const input = parseInput(reassignmentSchema, await c.req.json().catch(() => null), '请明确选择目标宾客、填写原因并核对影响范围');
  return c.json({ ok: true, data: reassignCheckin(parseId(c.req.param('id')), input.guestId, input.token, input.reason, c.get('user')) });
});
