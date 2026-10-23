import { createHash } from 'node:crypto';
import { and, asc, eq, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, sqlite } from '../db/client';
import { checkins, checkinSubmissions, gifts, guests, operationLogs, type CheckinRow } from '../db/schema';
import { findGuestCandidates, matchOrCreateGuest } from '../lib/guest';
import type { SessionPayload } from '../auth/jwt';
import { insertGiftWithAudit } from './gifts';
import { MAX_HEADCOUNT } from '../../shared/constraints';
import { generateToken, now } from '../lib/util';

export const selfCheckinSchema = z.object({ name: z.string().trim().min(1).max(30), submissionKey: z.uuid() });
export const attendanceFields = {
  actualHeadcount: z.number().int().min(1).max(MAX_HEADCOUNT),
  actualChildrenCount: z.number().int().min(0).max(MAX_HEADCOUNT),
};
const validAttendance = (v: { actualHeadcount: number; actualChildrenCount: number }) => v.actualChildrenCount <= v.actualHeadcount;
const checkinFields = z.object({
  ...attendanceFields,
  guestId: z.number().int().positive().safe().optional(),
  newGuest: z.object({
    groupName: z.string().trim().min(1).max(50),
    side: z.enum(['male', 'female', 'both']).optional(),
  }).optional(),
  amount: z.number().int().min(0).max(10_000_000),
  method: z.enum(['cash', 'wechat', 'alipay']).default('cash'),
  note: z.string().trim().max(500).nullable().optional().transform((value) => value || null),
});
export const confirmCheckinSchema = checkinFields.refine(validAttendance, '儿童人数不能超过实际总人数');
export const manualCheckinSchema = checkinFields.extend({
  guestName: z.string().trim().min(1).max(30),
  amount: checkinFields.shape.amount.default(0),
  submissionKey: z.uuid(),
}).refine(validAttendance, '儿童人数不能超过实际总人数');

export class CheckinError extends Error {
  constructor(public code: string, message: string, public status: 400 | 404 | 409 = 409) { super(message); }
}

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
function replay(submissionKey: string, payloadHash: string): CheckinRow | undefined {
  const saved = db.select().from(checkinSubmissions).where(eq(checkinSubmissions.keyHash, digest(submissionKey))).get();
  if (!saved) return undefined;
  if (saved.payloadHash !== payloadHash) {
    throw new CheckinError('IDEMPOTENCY_CONFLICT', '这次提交已保存且内容不同，请先查看签到记录，不要重复登记');
  }
  const row = db.select().from(checkins).where(eq(checkins.id, saved.checkinId)).get();
  if (!row) throw new CheckinError('NOT_FOUND', '原登记已移除，请重新登记', 404);
  return row;
}
function remember(submissionKey: string, payloadHash: string, checkinId: number) {
  db.insert(checkinSubmissions).values({ keyHash: digest(submissionKey), payloadHash, checkinId, createdAt: now() }).run();
}
function currentCheckin(guestId: number, exceptId?: number) {
  return db.select().from(checkins).where(and(eq(checkins.guestId, guestId), exceptId == null ? undefined : ne(checkins.id, exceptId), sql`${checkins.status} in ('pending', 'confirmed')`))
    .orderBy(sql`case when ${checkins.status} = 'confirmed' then 0 else 1 end`, asc(checkins.id)).get();
}
function rejectExisting(row: CheckinRow | undefined) {
  if (!row) return;
  if (row.status === 'confirmed') throw new CheckinError('ALREADY_CHECKED_IN', '该宾客已签到，请查看原签到记录；追加礼金请由管理员在礼金管理单独登记');
  throw new CheckinError('ALREADY_SUBMITTED', '该宾客已有待审核提交，请在现场审核处理原记录');
}
// 只有登录后的现场工作人员可显式建立另一位同名宾客。
function resolveGuest(name: string, input: z.infer<typeof confirmCheckinSchema>) {
  if (!input.newGuest) return matchOrCreateGuest(name, input.guestId);
  if (input.guestId != null) throw new CheckinError('INVALID_GUEST', '不能同时选择已有宾客与新建宾客', 400);
  const ts = now();
  return db.insert(guests).values({ name, ...input.newGuest, inviteToken: generateToken(),
    status: 'pending', createdAt: ts, updatedAt: ts }).returning({ id: guests.id, name: guests.name }).get();
}
function result(checkin: CheckinRow, duplicate = false) {
  const gift = db.select().from(gifts).where(eq(gifts.checkinId, checkin.id)).get() ?? null;
  return { checkin, gift, duplicate };
}

export function submitSelfCheckin(input: z.infer<typeof selfCheckinSchema>) {
  const payloadHash = digest(JSON.stringify({ action: 'self', name: input.name }));
  return sqlite.transaction(() => {
    const previous = replay(input.submissionKey, payloadHash);
    if (previous) return { id: previous.id, status: previous.status, duplicate: true };
    const candidates = findGuestCandidates(input.name);
    const matched = candidates.length > 1 ? { id: null, name: input.name } : matchOrCreateGuest(input.name);
    const existing = matched.id == null ? undefined : currentCheckin(matched.id);
    // 新标识可能是另一位同名临时宾客；姓名不能证明是同一个人。
    const row = db.insert(checkins).values({
      guestId: existing ? null : matched.id, guestName: matched.name, source: 'self', status: 'pending', submittedAt: now(),
    }).returning().get();
    remember(input.submissionKey, payloadHash, row.id);
    return { id: row.id, status: row.status, duplicate: false };
  }).immediate();
}

export function createManualCheckin(input: z.infer<typeof manualCheckinSchema>, actor: SessionPayload) {
  const payloadHash = digest(JSON.stringify({ action: 'manual', guestName: input.guestName, guestId: input.guestId ?? null,
    amount: input.amount, method: input.method, note: input.note, actualHeadcount: input.actualHeadcount, actualChildrenCount: input.actualChildrenCount, ...(input.newGuest ? { newGuest: input.newGuest } : {}) }));
  return sqlite.transaction(() => {
    const previous = replay(input.submissionKey, payloadHash);
    if (previous) return result(previous, true);
    const matched = resolveGuest(input.guestName, input);
    rejectExisting(currentCheckin(matched.id));
    const ts = now();
    const row = db.insert(checkins).values({ guestId: matched.id, guestName: matched.name, source: 'manual',
      status: 'confirmed', note: input.note, submittedAt: ts, confirmedAt: ts, actualHeadcount: input.actualHeadcount, actualChildrenCount: input.actualChildrenCount }).returning().get();
    if (input.amount > 0) insertGiftWithAudit({ guestId: matched.id, guestName: matched.name, amount: input.amount,
      method: input.method, note: input.note, checkinId: row.id, recordedAt: ts }, actor, '手动补录签到时登记实收礼金');
    remember(input.submissionKey, payloadHash, row.id);
    return result(row);
  }).immediate();
}

export function confirmCheckin(id: number, input: z.infer<typeof confirmCheckinSchema>, actor: SessionPayload) {
  return sqlite.transaction(() => {
    const existing = db.select().from(checkins).where(eq(checkins.id, id)).get();
    if (!existing) throw new CheckinError('NOT_FOUND', '提交不存在', 404);
    if (existing.status !== 'pending') throw new CheckinError('CONFLICT', '该提交已处理，请查看签到记录');
    const linkedGuest = existing.guestId == null ? undefined : db.select().from(guests).where(eq(guests.id, existing.guestId)).get();
    if (linkedGuest?.archivedAt != null) {
      throw new CheckinError('GUEST_ARCHIVED', '关联宾客已归档，请先由管理员恢复宾客，或驳回此提交');
    }
    if (existing.guestId != null && !linkedGuest)
      throw new CheckinError('INVALID_GUEST', '原关联宾客不存在，请重新核对');
    if (!input.newGuest && input.guestId == null && findGuestCandidates(linkedGuest?.name ?? existing.guestName).length > 1)
      throw new CheckinError('AMBIGUOUS_GUEST', '存在同名宾客，请核对分组和回执后选择对应宾客');
    // A name correction must never silently replace an already linked identity.
    const matched = resolveGuest(linkedGuest?.name ?? existing.guestName, {
      ...input,
      guestId: input.newGuest ? undefined : input.guestId ?? linkedGuest?.id,
    });
    rejectExisting(currentCheckin(matched.id, id));
    const row = db.update(checkins).set({ status: 'confirmed', confirmedAt: now(), guestId: matched.id, guestName: matched.name, note: input.note, actualHeadcount: input.actualHeadcount, actualChildrenCount: input.actualChildrenCount })
      .where(and(eq(checkins.id, id), eq(checkins.status, 'pending'))).returning().get();
    if (!row) throw new CheckinError('CONFLICT', '该提交已被处理，请刷新后查看');
    if (input.amount > 0) insertGiftWithAudit({ guestId: matched.id, guestName: matched.name, amount: input.amount,
      method: input.method, note: input.note, checkinId: id, recordedAt: now() }, actor, '现场审核签到时登记实收礼金');
    return result(row);
  }).immediate();
}


export const attendanceCorrectionSchema = z.object({
  ...attendanceFields,
  expectedHeadcount: attendanceFields.actualHeadcount.nullable(),
  expectedChildrenCount: attendanceFields.actualChildrenCount.nullable(),
  reason: z.string().trim().min(1).max(200),
}).strict().refine(validAttendance, '儿童人数不能超过实际总人数');

export function correctAttendance(id: number, input: z.infer<typeof attendanceCorrectionSchema>, actor: SessionPayload) {
  return sqlite.transaction(() => {
    const current = db.select().from(checkins).where(eq(checkins.id, id)).get();
    if (!current || current.status !== 'confirmed') throw new CheckinError('CONFLICT', '仅可补记或更正已确认签到的人数，请刷新后核对');
    if (current.actualHeadcount !== input.expectedHeadcount || current.actualChildrenCount !== input.expectedChildrenCount) {
      throw new CheckinError('CONFLICT', '人数已被其他操作更新，请刷新后重新核对');
    }
    if (current.actualHeadcount === input.actualHeadcount && current.actualChildrenCount === input.actualChildrenCount) {
      throw new CheckinError('CONFLICT', '人数未变化，无需重复保存');
    }
    const row = db.update(checkins).set({ actualHeadcount: input.actualHeadcount, actualChildrenCount: input.actualChildrenCount })
      .where(eq(checkins.id, id)).returning().get();
    db.insert(operationLogs).values({ entity: 'checkin', entityId: id, action: 'attendance', reason: input.reason,
      actorId: actor.id, actorName: actor.username, actorRole: actor.role, before: JSON.stringify(current), after: JSON.stringify(row), createdAt: now() }).run();
    return row;
  }).immediate();
}
