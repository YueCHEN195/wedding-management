import { createHash } from 'node:crypto';
import { and, asc, desc, eq, ne } from 'drizzle-orm';
import { db, sqlite } from '../db/client';
import { checkins, gifts, guests, operationLogs, rsvps } from '../db/schema';
import type { SessionPayload } from '../auth/jwt';
import type { LifecycleAction, LifecycleEntity, LifecyclePreview, OperationLogDTO } from '../../shared/types';

export class LifecycleError extends Error {
  constructor(public code: string, message: string, public status: 400 | 403 | 404 | 409 = 409) { super(message); }
}

function load(entity: LifecycleEntity, id: number) {
  const checkin = entity === 'checkin' ? db.select().from(checkins).where(eq(checkins.id, id)).get() : undefined;
  const gift = entity === 'gift' ? db.select().from(gifts).where(eq(gifts.id, id)).get() : undefined;
  const giftCheckin = gift?.checkinId == null ? undefined : db.select().from(checkins).where(eq(checkins.id, gift.checkinId)).get();
  const guestId = entity === 'guest' ? id : checkin?.guestId ?? gift?.guestId;
  const guest = guestId == null ? undefined : db.select().from(guests).where(eq(guests.id, guestId)).get();
  if (entity === 'guest' ? !guest : entity === 'checkin' ? !checkin : !gift) {
    throw new LifecycleError('NOT_FOUND', '记录不存在，请刷新列表', 404);
  }
  const rsvpRows = guestId != null ? db.select().from(rsvps).where(eq(rsvps.guestId, guestId)).orderBy(asc(rsvps.id)).all() : [];
  const checkinRows = entity === 'guest' ? db.select().from(checkins).where(eq(checkins.guestId, id)).orderBy(asc(checkins.id)).all() : checkin ? [checkin] : giftCheckin ? [giftCheckin] : [];
  const giftRows = entity === 'guest' ? db.select().from(gifts).where(eq(gifts.guestId, id)).orderBy(asc(gifts.id)).all()
    : checkin ? db.select().from(gifts).where(eq(gifts.checkinId, id)).orderBy(asc(gifts.id)).all() : [gift!];
  const otherCheckins = checkin?.guestId == null ? [] : db.select().from(checkins)
    .where(and(eq(checkins.guestId, checkin.guestId), ne(checkins.id, id))).orderBy(asc(checkins.id)).all();
  const history = db.select().from(operationLogs).where(and(eq(operationLogs.entity, entity), eq(operationLogs.entityId, id)))
    .orderBy(desc(operationLogs.id)).all();
  return { guest, checkin, gift, giftCheckin, rsvpRows, checkinRows, giftRows, otherCheckins, history };
}

function validate(state: ReturnType<typeof load>, entity: LifecycleEntity, action: LifecycleAction, actor: SessionPayload) {
  const { guest, checkin, gift } = state;
  if (actor.role !== 'admin' && (entity !== 'checkin' || action === 'cancel' || checkin?.status === 'cancelled')) {
    throw new LifecycleError('FORBIDDEN', '此操作仅限管理员', 403);
  }
  const invalid = () => { throw new LifecycleError('CONFLICT', '记录状态已变化，当前不能执行此操作，请重新核对'); };
  if (entity === 'guest') {
    if (action === 'archive') { if (guest!.archivedAt != null) invalid(); }
    else if (action === 'restore') { if (guest!.archivedAt == null) invalid(); }
    else invalid();
  } else if (entity === 'gift') {
    if (action === 'void') { if (gift!.voidedAt != null) invalid(); }
    else if (action === 'restore') { if (gift!.voidedAt == null) invalid(); }
    else invalid();
  } else {
    if (action === 'reject') { if (checkin!.status !== 'pending') invalid(); }
    else if (action === 'cancel') { if (checkin!.status !== 'confirmed') invalid(); }
    else if (action === 'restore') {
      if (checkin!.status !== 'rejected' && checkin!.status !== 'cancelled') invalid();
      if (guest?.archivedAt != null) throw new LifecycleError('GUEST_ARCHIVED', '关联宾客已归档，请先由管理员恢复宾客');
      if (state.otherCheckins.some((c) => c.status === 'pending' || c.status === 'confirmed')) {
        throw new LifecycleError('ALREADY_SUBMITTED', '该宾客已有待审或已确认签到，请先核对原记录');
      }
    } else invalid();
  }
}

function historyToDTO(log: typeof operationLogs.$inferSelect): OperationLogDTO {
  const { id, action, reason, actorName, createdAt } = log;
  if (log.entity === 'gift' && (action === 'create' || action === 'edit')) {
    const before = JSON.parse(log.before);
    const after = JSON.parse(log.after);
    const methods: Record<string, string> = { cash: '现金', wechat: '微信', alipay: '支付宝' };
    const describe = (v: { amount: number; method: string; note: string | null }) => `¥${(v.amount / 100).toFixed(2)} · ${methods[v.method] ?? v.method} · 备注：${v.note || '未填'}`;
    return { id, action, reason, actorName, createdAt, detail: before ? `${describe(before)} → ${describe(after)}` : describe(after) };
  }
  if (action !== 'attendance') return { id, action, reason, actorName, createdAt };
  const before = JSON.parse(log.before);
  const after = JSON.parse(log.after);
  const label = (v: { actualHeadcount: number | null; actualChildrenCount: number | null }) => v.actualHeadcount == null
    ? '人数待补记' : `${v.actualHeadcount}人（其中儿童${v.actualChildrenCount ?? 0}人）`;
  return { id, action, reason, actorName, createdAt, detail: `${label(before)} → ${label(after)}` };
}

function preview(state: ReturnType<typeof load>, entity: LifecycleEntity, id: number, action: LifecycleAction): LifecyclePreview {
  const effects = {
    guest: action === 'archive' ? '从当前名单与预计出席统计中隐藏，专属请柬停止接受回执。历史回执、签到、礼金及关联完整保留；已到场统计和礼金总额不变，可恢复。'
      : '恢复当前名单与预计出席统计，专属请柬重新可用。历史签到和礼金不重建、不重复计入。',
    gift: action === 'void' ? '此笔礼金退出有效金额和笔数统计；原金额、宾客及签到关联保留，不影响签到，可由管理员恢复。'
      : '恢复此笔原礼金，原金额重新计入有效金额和笔数；不创建新账目，不影响签到。',
    checkin: action === 'reject' ? '仅将本次待审标记为已驳回，保留原提交与操作记录，不删除或作废任何礼金。'
      : action === 'cancel' ? `撤销本次到场确认，当前到场统计减少1组${state.checkin?.actualHeadcount == null ? '（该组人数待补记）' : `、${state.checkin.actualHeadcount}人（其中儿童${state.checkin.actualChildrenCount ?? 0}人）`}。已有礼金继续有效，若礼金也录错请另行作废。`
        : state.checkin?.status === 'cancelled' ? `恢复原到场确认，当前到场统计增加1组${state.checkin?.actualHeadcount == null ? '（该组人数待补记）' : `、${state.checkin.actualHeadcount}人（其中儿童${state.checkin.actualChildrenCount ?? 0}人）`}。原礼金不重建、不改变有效状态。`
          : '恢复原提交到待审核队列，仍需工作人员核对；不会直接增加到场统计或礼金。',
  };
  return {
    entity, id, action, name: entity === 'guest' ? state.guest!.name : entity === 'checkin' ? state.checkin!.guestName : state.gift!.guestName,
    token: createHash('sha256').update(JSON.stringify({ entity, id, action, state })).digest('hex'),
    rsvpCount: state.rsvpRows.length, checkinCount: state.checkinRows.length,
    giftCount: state.giftRows.length, giftTotal: state.giftRows.filter((g) => g.voidedAt == null).reduce((sum, g) => sum + g.amount, 0),
    originalGiftTotal: state.giftRows.reduce((sum, g) => sum + g.amount, 0),
    effect: effects[entity] + (entity === 'gift' ? ` 本次有效金额${action === 'void' ? '减少' : '增加'} ¥${(state.gift!.amount / 100).toFixed(2)}。` : ''),
    history: state.history.map(historyToDTO),
  };
}

export function previewLifecycle(entity: LifecycleEntity, id: number, action: LifecycleAction, actor: SessionPayload) {
  return sqlite.transaction(() => {
    const state = load(entity, id); validate(state, entity, action, actor);
    return preview(state, entity, id, action);
  })();
}

export function applyLifecycle(entity: LifecycleEntity, id: number, action: LifecycleAction, reason: string, token: string, actor: SessionPayload) {
  return sqlite.transaction(() => {
    const state = load(entity, id); validate(state, entity, action, actor);
    if (preview(state, entity, id, action).token !== token) {
      throw new LifecycleError('STALE_PREVIEW', '对象或关联数据已变化，请重新核对最新影响后再确认');
    }
    const ts = Date.now();
    const before = entity === 'guest' ? state.guest! : entity === 'checkin' ? state.checkin! : state.gift!;
    const after = entity === 'guest'
      ? db.update(guests).set({ archivedAt: action === 'archive' ? ts : null, updatedAt: Math.max(ts, state.guest!.updatedAt + 1) }).where(eq(guests.id, id)).returning().get()!
      : entity === 'gift'
        ? db.update(gifts).set({ voidedAt: action === 'void' ? ts : null, version: state.gift!.version + 1 }).where(eq(gifts.id, id)).returning().get()!
        : db.update(checkins).set({ status: action === 'reject' ? 'rejected' : action === 'cancel' ? 'cancelled'
          : state.checkin!.status === 'cancelled' ? 'confirmed' : 'pending' }).where(eq(checkins.id, id)).returning().get()!;
    db.insert(operationLogs).values({ entity, entityId: id, action, reason, actorId: actor.id, actorName: actor.username,
      actorRole: actor.role, before: JSON.stringify(before), after: JSON.stringify(after), createdAt: ts }).run();
    return true;
  }).immediate();
}

export function lifecycleHistory(entity: LifecycleEntity, id: number, actor: SessionPayload) {
  if (actor.role !== 'admin' && entity !== 'checkin') throw new LifecycleError('FORBIDDEN', '此操作仅限管理员', 403);
  return load(entity, id).history.map(historyToDTO);
}
