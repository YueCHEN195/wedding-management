import { Hono } from 'hono';
import { allow, clientIp } from '../lib/rateLimit';
import { qrPng } from '../services/qrcode';
import { attachmentHeaders, binaryResponse } from '../lib/http';
import { env } from '../env';
import { CheckinError, selfCheckinSchema, submitSelfCheckin } from '../services/checkins';
import { requireAuth, requireAdmin, type AppEnv } from '../auth/middleware';
import { renderCheckinDisplay } from '../services/media';
import { isPreviewDestination } from '../services/mediaPresentation';
import { MEDIA_OUTPUTS } from '../../shared/media';

export const publicCheckinRoutes = new Hono<AppEnv>();
const checkinUrl = () => `${env.publicBaseUrl.replace(/\/$/, '')}/checkin`;
publicCheckinRoutes.onError((err, c) => {
  if (err instanceof CheckinError)
    return c.json({ ok: false, error: { code: err.code, message: err.message } }, err.status);
  throw err;
});

/** 自助签到：提交姓名 → 生成待审记录（散客自动建档） */
publicCheckinRoutes.post('/self', async (c) => {
  if (!allow(`checkin-self:${clientIp(c)}`, 30, 60_000)) {
    return c.json(
      { ok: false, error: { code: 'RATE_LIMITED', message: '提交过于频繁，请稍后再试' } },
      429,
    );
  }
  const parsed = selfCheckinSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success)
    return c.json(
      {
        ok: false,
        error: {
          code: 'VALIDATION',
          message: '请输入姓名（最多30字）；如页面已打开较久，请刷新后重新提交',
        },
      },
      400,
    );
  c.header('Cache-Control', 'no-store');
  return c.json({ ok: true, data: submitSelfCheckin(parsed.data) });
});

/** 现场入口总码（编码 /checkin 链接） */
publicCheckinRoutes.get('/qr', async (c) => {
  const buf = await qrPng(checkinUrl(), 640);
  return binaryResponse(buf, {
    ...(c.req.query('download') === '1'
      ? attachmentHeaders(
          `签到二维码${isPreviewDestination(checkinUrl()) ? '-预览' : ''}.png`,
          'image/png',
        )
      : { 'Content-Type': 'image/png' }),
    'Cache-Control': 'no-store',
  });
});

/** Read-only output tools; the public QR and self check-in keep their original access. */
publicCheckinRoutes.get('/materials', requireAuth, requireAdmin, (c) => {
  c.header('Cache-Control', 'no-store');
  return c.json({
    ok: true,
    data: { url: checkinUrl(), preview: isPreviewDestination(checkinUrl()) },
  });
});
publicCheckinRoutes.get('/display', requireAuth, requireAdmin, async (c) => {
  const format = c.req.query('format');
  if (format !== 'table' && format !== 'sign')
    return c.json(
      { ok: false, error: { code: 'VALIDATION', message: '请选择签到桌牌或入口导视' } },
      400,
    );
  const buffer = await renderCheckinDisplay(checkinUrl(), format);
  const suffix = isPreviewDestination(checkinUrl()) ? '-预览' : '';
  return binaryResponse(buffer, {
    ...(c.req.query('download') === '1'
      ? attachmentHeaders(`${MEDIA_OUTPUTS[format].title}${suffix}.png`, 'image/png')
      : { 'Content-Type': 'image/png' }),
    'Cache-Control': 'no-store',
  });
});
