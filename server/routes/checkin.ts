import { Hono } from 'hono';
import { db } from '../db/client';
import { checkins } from '../db/schema';
import { findGuestCandidates, matchOrCreateGuest } from '../lib/guest';
import { now, str } from '../lib/util';
import { allow, clientIp } from '../lib/rateLimit';
import { qrPng } from '../services/qrcode';
import { binaryResponse } from '../lib/http';
import { and, eq } from 'drizzle-orm';
import { env } from '../env';

export const publicCheckinRoutes = new Hono();

/** 自助签到：提交姓名 → 生成待审记录（散客自动建档） */
publicCheckinRoutes.post('/self', async (c) => {
  if (!allow(`checkin-self:${clientIp(c)}`, 30, 60_000)) {
    return c.json({ ok: false, error: { code: 'RATE_LIMITED', message: '提交过于频繁，请稍后再试' } }, 429);
  }
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = str(body.name);
  if (!name) return c.json({ ok: false, error: { code: 'VALIDATION', message: '请输入姓名' } }, 400);
  if (name.length > 30) return c.json({ ok: false, error: { code: 'VALIDATION', message: '姓名过长' } }, 400);

  // 同名提交先保留为未关联；两位同名宾客不能互相去重。
  const candidates = findGuestCandidates(name);
  const matched = candidates.length > 1 ? { id: null, name } : matchOrCreateGuest(name);
  const existing = matched.id == null ? undefined : db
    .select()
    .from(checkins)
    .where(and(eq(checkins.guestId, matched.id), eq(checkins.status, 'pending')))
    .get();
  if (existing) {
    return c.json({ ok: true, data: { id: existing.id, duplicate: true } });
  }
  const row = db
    .insert(checkins)
    .values({
      guestId: matched.id,
      guestName: matched.name,
      source: 'self',
      status: 'pending',
      submittedAt: now(),
    })
    .returning()
    .get();
  return c.json({ ok: true, data: { id: row.id, duplicate: false } });
});

/** 现场入口总码（编码 /checkin 链接） */
publicCheckinRoutes.get('/qr', async (c) => {
  const base = env.publicBaseUrl;
  const buf = await qrPng(`${base.replace(/\/$/, '')}/checkin`, 640);
  return binaryResponse(buf, {
    'Content-Type': 'image/png',
    'Cache-Control': 'no-store',
  });
});
