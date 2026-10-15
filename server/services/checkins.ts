import { createHash } from 'node:crypto';
import { and, asc, eq, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, sqlite } from '../db/client';
import { checkins, checkinSubmissions, gifts, guests, type CheckinRow } from '../db/schema';
import { findGuestCandidates, matchOrCreateGuest } from '../lib/guest';
import { generateToken, now } from '../lib/util';

export const selfCheckinSchema = z.object({ name: z.string().trim().min(1).max(30), submissionKey: z.uuid() });
export const confirmCheckinSchema = z.object({
  guestId: z.number().int().positive().safe().optional(),
  newGuest: z.object({
    groupName: z.string().trim().min(1).max(50),
    side: z.enum(['male', 'female', 'both']).optional(),
  }).optional(),
  amount: z.number().int().min(0).max(10_000_000),
  method: z.enum(['cash', 'wechat', 'alipay']).default('cash'),
  note: z.string().trim().max(500).nullable().optional().transform((value) => value || null),
});
export const manualCheckinSchema = confirmCheckinSchema.extend({
  guestName: z.string().trim().min(1).max(30),
  amount: confirmCheckinSchema.shape.amount.default(0),
  submissionKey: z.uuid(),
});

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

export function createManualCheckin(input: z.infer<typeof manualCheckinSchema>) {
  const payloadHash = digest(JSON.stringify({ action: 'manual', guestName: input.guestName, guestId: input.guestId ?? null,
    amount: input.amount, method: input.method, note: input.note, ...(input.newGuest ? { newGuest: input.newGuest } : {}) }));
  return sqlite.transaction(() => {
    const previous = replay(input.submissionKey, payloadHash);
    if (previous) return result(previous, true);
    const matched = resolveGuest(input.guestName, input);
    rejectExisting(currentCheckin(matched.id));
    const ts = now();
    const row = db.insert(checkins).values({ guestId: matched.id, guestName: matched.name, source: 'manual',
      status: 'confirmed', note: input.note, submittedAt: ts, confirmedAt: ts }).returning().get();
    if (input.amount > 0) db.insert(gifts).values({ guestId: matched.id, guestName: matched.name, amount: input.amount,
      method: input.method, note: input.note, checkinId: row.id, recordedAt: ts }).run();
    remember(input.submissionKey, payloadHash, row.id);
    return result(row);
  }).immediate();
}

export function confirmCheckin(id: number, input: z.infer<typeof confirmCheckinSchema>) {
  return sqlite.transaction(() => {
    const existing = db.select().from(checkins).where(eq(checkins.id, id)).get();
    if (!existing) throw new CheckinError('NOT_FOUND', '提交不存在', 404);
    if (existing.status !== 'pending') throw new CheckinError('CONFLICT', '该提交已处理，请查看签到记录');
    if (existing.guestId != null && db.select().from(guests).where(eq(guests.id, existing.guestId)).get()?.archivedAt != null) {
      throw new CheckinError('GUEST_ARCHIVED', '关联宾客已归档，请先由管理员恢复宾客，或驳回此提交');
    }
    const matched = resolveGuest(existing.guestName, input);
    rejectExisting(currentCheckin(matched.id, id));
    const row = db.update(checkins).set({ status: 'confirmed', confirmedAt: now(), guestId: matched.id, guestName: matched.name, note: input.note })
      .where(and(eq(checkins.id, id), eq(checkins.status, 'pending'))).returning().get();
    if (!row) throw new CheckinError('CONFLICT', '该提交已被处理，请刷新后查看');
    if (input.amount > 0) db.insert(gifts).values({ guestId: matched.id, guestName: matched.name, amount: input.amount,
      method: input.method, note: input.note, checkinId: id, recordedAt: now() }).run();
    return result(row);
  }).immediate();
}
