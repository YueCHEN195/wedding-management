import { Hono } from 'hono';
import { allow, clientIp } from '../lib/rateLimit';
import { qrPng } from '../services/qrcode';
import { binaryResponse } from '../lib/http';
import { env } from '../env';
import { CheckinError, selfCheckinSchema, submitSelfCheckin } from '../services/checkins';

export const publicCheckinRoutes = new Hono();
publicCheckinRoutes.onError((err, c) => {
  if (err instanceof CheckinError) return c.json({ ok: false, error: { code: err.code, message: err.message } }, err.status);
  throw err;
});

/** 自助签到：提交姓名 → 生成待审记录（散客自动建档） */
publicCheckinRoutes.post('/self', async (c) => {
  if (!allow(`checkin-self:${clientIp(c)}`, 30, 60_000)) {
    return c.json({ ok: false, error: { code: 'RATE_LIMITED', message: '提交过于频繁，请稍后再试' } }, 429);
  }
  const parsed = selfCheckinSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ ok: false, error: { code: 'VALIDATION', message: '请输入姓名（最多30字）；如页面已打开较久，请刷新后重新提交' } }, 400);
  c.header('Cache-Control', 'no-store');
  return c.json({ ok: true, data: submitSelfCheckin(parsed.data) });
});

/** 现场入口总码（编码 /checkin 链接） */
publicCheckinRoutes.get('/qr', async (_c) => {
  const base = env.publicBaseUrl;
  const buf = await qrPng(`${base.replace(/\/$/, '')}/checkin`, 640);
  return binaryResponse(buf, {
    'Content-Type': 'image/png',
    'Cache-Control': 'no-store',
  });
});
