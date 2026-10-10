import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { guests } from '../db/schema';
import { generateToken, now } from './util';

/**
 * 按姓名匹配宾客；命中（即使重名）取第一条；未命中则自动新建（散客自动建档）。
 */
export function matchOrCreateGuest(name: string, guestId?: number | null): { id: number; name: string } {
  if (guestId) {
    const g = db.select().from(guests).where(eq(guests.id, guestId)).get();
    if (g) return { id: g.id, name: g.name };
  }
  const matches = db.select().from(guests).where(eq(guests.name, name)).all();
  if (matches.length >= 1) return { id: matches[0].id, name: matches[0].name };
  const ts = now();
  const created = db
    .insert(guests)
    .values({ name, inviteToken: generateToken(), status: 'pending', createdAt: ts, updatedAt: ts })
    .returning()
    .get();
  return { id: created.id, name: created.name };
}
