import { Hono } from 'hono';
import { db } from '../db/client';
import { checkins, gifts, guests, rsvps } from '../db/schema';
import { requireAdmin, requireAuth, type AppEnv } from '../auth/middleware';
import type { GiftMethod, StatsCharts, StatsSummary } from '../../shared/types';

export const statsRoutes = new Hono<AppEnv>();
statsRoutes.use('*', requireAuth, requireAdmin);

function computeSummary(): StatsSummary {
  const allGuests = db.select().from(guests).all();
  const allRsvps = db.select().from(rsvps).all();
  const allCheckins = db.select().from(checkins).all();
  const allGifts = db.select().from(gifts).all();

  return {
    guestTotal: allGuests.length,
    invitedCount: allGuests.filter((g) => g.status !== 'pending').length,
    rsvpCount: allGuests.filter((g) => g.status === 'rsvp').length,
    attendingHeadcount: allRsvps.filter((r) => r.attending === 'yes').reduce((s, r) => s + r.headcount, 0),
    checkinCount: allCheckins.filter((c) => c.status === 'confirmed').length,
    pendingCheckinCount: allCheckins.filter((c) => c.status === 'pending').length,
    giftTotal: allGifts.reduce((s, g) => s + g.amount, 0),
    giftCount: allGifts.length,
  };
}

statsRoutes.get('/summary', (c) => c.json({ ok: true, data: computeSummary() }));

statsRoutes.get('/charts', (c) => {
  const allGuests = db.select().from(guests).all();
  const allRsvps = db.select().from(rsvps).all();
  const allGifts = db.select().from(gifts).all();

  const rsvp = { yes: 0, no: 0, maybe: 0 };
  for (const r of allRsvps) rsvp[r.attending]++;

  const methodMap = new Map<GiftMethod, { amount: number; count: number }>();
  for (const g of allGifts) {
    const cur = methodMap.get(g.method) ?? { amount: 0, count: 0 };
    cur.amount += g.amount;
    cur.count++;
    methodMap.set(g.method, cur);
  }

  const sideMap = new Map<string, number>();
  for (const g of allGuests) {
    const key = g.side ?? 'unknown';
    sideMap.set(key, (sideMap.get(key) ?? 0) + 1);
  }

  const groupMap = new Map<string, number>();
  for (const g of allGuests) {
    const key = g.groupName ?? '未分组';
    groupMap.set(key, (groupMap.get(key) ?? 0) + 1);
  }

  const data: StatsCharts = {
    rsvp,
    giftByMethod: [...methodMap.entries()].map(([m, v]) => ({ method: m, amount: v.amount, count: v.count })),
    guestBySide: [...sideMap.entries()].map(([side, count]) => ({ side, count })),
    guestByGroup: [...groupMap.entries()].map(([group, count]) => ({ group, count })),
  };
  return c.json({ ok: true, data });
});
