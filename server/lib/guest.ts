import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../db/client';
import { checkins, guests, rsvps } from '../db/schema';
import { generateToken, now } from './util';
import type { GuestCandidate } from '../../shared/types';

export class GuestMatchError extends Error {
  constructor(public code: 'AMBIGUOUS_GUEST' | 'INVALID_GUEST', message: string, public status: 400 | 409) {
    super(message);
  }
}

export function findGuestCandidates(name: string): GuestCandidate[] {
  const rows = db.select({ id: guests.id, name: guests.name, groupName: guests.groupName, side: guests.side })
    .from(guests).where(and(eq(guests.name, name), isNull(guests.archivedAt))).orderBy(asc(guests.id)).all();
  if (!rows.length) return [];
  const latest = new Map<number, typeof rsvps.$inferSelect>();
  for (const r of db.select().from(rsvps).where(inArray(rsvps.guestId, rows.map((g) => g.id)))
    .orderBy(desc(rsvps.updatedAt), desc(rsvps.id)).all()) {
    if (r.guestId != null && !latest.has(r.guestId)) latest.set(r.guestId, r);
  }
  const checkedInIds = new Set(db.selectDistinct({ guestId: checkins.guestId }).from(checkins)
    .where(and(inArray(checkins.guestId, rows.map((g) => g.id)), eq(checkins.status, 'confirmed')))
    .all().map((c) => c.guestId));
  return rows.map((g) => ({ ...g, attending: latest.get(g.id)?.attending ?? null, headcount: latest.get(g.id)?.headcount ?? null, checkedIn: checkedInIds.has(g.id) }));
}

/** 显式选择必须有效且同名；多名候选不能猜测，未命中才建档。 */
export function matchOrCreateGuest(name: string, guestId?: unknown): { id: number; name: string } {
  if (guestId != null) {
    if (typeof guestId !== 'number' || !Number.isSafeInteger(guestId) || guestId <= 0) {
      throw new GuestMatchError('INVALID_GUEST', '宾客选择无效，请重新选择', 400);
    }
    const g = db.select().from(guests).where(eq(guests.id, guestId)).get();
    if (!g || g.name !== name || g.archivedAt != null) {
      throw new GuestMatchError('INVALID_GUEST', '所选宾客已变更或与提交姓名不符，请刷新后重新选择', 400);
    }
    return { id: g.id, name: g.name };
  }
  const matches = db.select({ id: guests.id, name: guests.name }).from(guests).where(and(eq(guests.name, name), isNull(guests.archivedAt))).all();
  if (matches.length > 1) {
    throw new GuestMatchError('AMBIGUOUS_GUEST', '存在同名宾客，请核对分组、归属方和回执后选择对应宾客', 409);
  }
  if (matches.length === 1) return matches[0];
  const ts = now();
  const created = db
    .insert(guests)
    .values({ name, inviteToken: generateToken(), status: 'pending', createdAt: ts, updatedAt: ts })
    .returning()
    .get();
  return { id: created.id, name: created.name };
}
