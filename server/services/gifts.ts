import { and, eq, isNull } from 'drizzle-orm';
import type { z } from 'zod';
import { db, sqlite } from '../db/client';
import { gifts, operationLogs, type GiftRow } from '../db/schema';
import type { SessionPayload } from '../auth/jwt';
import type { giftPatchSchema } from '../lib/validation';
import { now } from '../lib/util';

export class GiftEditError extends Error {
  constructor(public code: 'CONFLICT' | 'VERSION_CONFLICT' | 'NO_CHANGES', message: string) { super(message); }
}
function recordGift(action: 'create' | 'edit', before: GiftRow | null, after: GiftRow, actor: SessionPayload, reason: string) {
  db.insert(operationLogs).values({ entity: 'gift', entityId: after.id, action, reason,
    actorId: actor.id, actorName: actor.username, actorRole: actor.role,
    before: JSON.stringify(before), after: JSON.stringify(after), createdAt: now() }).run();
}
/** 与调用方的签到、关联或独立记账共用同一事务。 */
export function insertGiftWithAudit(values: typeof gifts.$inferInsert, actor: SessionPayload, reason: string) {
  const row = db.insert(gifts).values(values).returning().get();
  recordGift('create', null, row, actor, reason);
  return row;
}
export function editGift(id: number, input: z.infer<typeof giftPatchSchema>, actor: SessionPayload) {
  return sqlite.transaction(() => {
    const current = db.select().from(gifts).where(eq(gifts.id, id)).get();
    if (!current || current.voidedAt != null) throw new GiftEditError('CONFLICT', '礼金已撤回或不存在，不能编辑，请核对最新记录');
    if (current.version !== input.expectedVersion) throw new GiftEditError('VERSION_CONFLICT', '这笔礼金已被其他操作更新，你的修改尚未保存，请核对最新记录');
    const { expectedVersion, reason, ...patch } = input;
    const next = { ...current, ...patch };
    if (next.amount === current.amount && next.method === current.method && next.note === current.note) {
      throw new GiftEditError('NO_CHANGES', '内容没有变化，无需重复保存');
    }
    const row = db.update(gifts).set({ ...patch, version: current.version + 1 })
      .where(and(eq(gifts.id, id), eq(gifts.version, expectedVersion), isNull(gifts.voidedAt))).returning().get();
    if (!row) throw new GiftEditError('VERSION_CONFLICT', '记录已更新，请核对最新记录');
    recordGift('edit', current, row, actor, reason);
    return row;
  }).immediate();
}
