import { createHash } from 'node:crypto';
import { and, asc, eq, inArray, ne } from 'drizzle-orm';
import { db, sqlite } from '../db/client';
import { checkins, gifts, guests, operationLogs } from '../db/schema';
import type { SessionPayload } from '../auth/jwt';
import type { CheckinReassignmentPreview } from '../../shared/types';
import { LifecycleError } from './lifecycle';

function load(checkinId: number, guestId: number) {
  const record = db.select().from(checkins).where(eq(checkins.id, checkinId)).get();
  const target = db.select().from(guests).where(eq(guests.id, guestId)).get();
  if (!record || record.status !== 'confirmed')
    throw new LifecycleError('CONFLICT', '仅可纠正已确认签到的关联，请刷新核对');
  if (!target || target.archivedAt != null)
    throw new LifecycleError('CONFLICT', '目标宾客不存在或已归档，请重新选择');
  if (record.guestId === guestId) throw new LifecycleError('NO_CHANGES', '已关联此宾客，无需更正');
  const occupied = db
    .select({ id: checkins.id })
    .from(checkins)
    .where(
      and(
        eq(checkins.guestId, guestId),
        ne(checkins.id, checkinId),
        inArray(checkins.status, ['pending', 'confirmed']),
      ),
    )
    .get();
  if (occupied)
    throw new LifecycleError(
      'CONFLICT',
      `目标宾客已有待审或有效签到 #${occupied.id}，请先核对原记录，不自动合并`,
    );
  const linkedGifts = db
    .select()
    .from(gifts)
    .where(eq(gifts.checkinId, checkinId))
    .orderBy(asc(gifts.id))
    .all();
  return { record, target, linkedGifts };
}
const token = (state: ReturnType<typeof load>) =>
  createHash('sha256').update(JSON.stringify(state)).digest('hex');
export function previewCheckinReassignment(
  checkinId: number,
  guestId: number,
): CheckinReassignmentPreview {
  return sqlite.transaction(() => {
    const state = load(checkinId, guestId);
    return {
      token: token(state),
      from: { id: state.record.guestId, name: state.record.guestName },
      to: { id: state.target.id, name: state.target.name },
      gifts: state.linkedGifts.map((gift) => ({
        id: gift.id,
        amount: gift.amount,
        voidedAt: gift.voidedAt,
      })),
      actualHeadcount: state.record.actualHeadcount,
      actualChildrenCount: state.record.actualChildrenCount,
    };
  })();
}
export function reassignCheckin(
  checkinId: number,
  guestId: number,
  expectedToken: string,
  reason: string,
  actor: SessionPayload,
) {
  return sqlite
    .transaction(() => {
      const state = load(checkinId, guestId);
      if (token(state) !== expectedToken)
        throw new LifecycleError(
          'STALE_PREVIEW',
          '签到、礼金或目标档案已变化，请重新核对；当前填写已保留',
        );
      const ts = Date.now();
      const after = db
        .update(checkins)
        .set({ guestId, guestName: state.target.name })
        .where(eq(checkins.id, checkinId))
        .returning()
        .get()!;
      const audit = (
        entity: 'checkin' | 'gift',
        entityId: number,
        before: unknown,
        next: unknown,
      ) => {
        db.insert(operationLogs)
          .values({
            entity,
            entityId,
            action: 'reassign',
            reason,
            actorId: actor.id,
            actorName: actor.username,
            actorRole: actor.role,
            before: JSON.stringify(before),
            after: JSON.stringify(next),
            createdAt: ts,
          })
          .run();
      };
      audit('checkin', checkinId, state.record, after);
      for (const gift of state.linkedGifts) {
        const next = db
          .update(gifts)
          .set({ guestId, guestName: state.target.name, version: gift.version + 1 })
          .where(eq(gifts.id, gift.id))
          .returning()
          .get()!;
        audit('gift', gift.id, gift, next);
      }
      return true;
    })
    .immediate();
}
