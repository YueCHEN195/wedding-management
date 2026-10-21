import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { Hono } from 'hono';
import { catQrMatrix, qrPng } from '../server/services/qrcode';
import { renderPoster, renderCheckinDisplay } from '../server/services/media';
import { artworkText, escapeXml, isPreviewDestination } from '../server/services/mediaPresentation';
import { MEDIA_OUTPUTS, type MediaOutputInfo } from '../shared/media';

const dir = mkdtempSync(join(tmpdir(), 'wedding-media-'));
process.env.DB_PATH = join(dir, 'test.db');
process.env.PUBLIC_BASE_URL = 'http://localhost:5173';
const { publicCheckinRoutes } = await import('../server/routes/checkin');
const { createToken } = await import('../server/auth/jwt');
const { sqlite } = await import('../server/db/client');
const app = new Hono().route('/api/checkin', publicCheckinRoutes);
const adminCookie = `wedding_session=${await createToken({ id: 1, username: 'media-test', role: 'admin' })}`;
const staffCookie = `wedding_session=${await createToken({ id: 2, username: 'media-test-staff', role: 'staff' })}`;
after(() => {
  sqlite.close();
  rmSync(dir, { recursive: true, force: true });
});

test('预览目的地包括本机、示例、IP和非 HTTPS，不能误标成正式物料', () => {
  for (const url of [
    'http://wedding.real-domain.cn/checkin',
    'https://localhost/checkin',
    'https://192.168.1.2/checkin',
    'https://[::1]/checkin',
    'https://wedding.example.invalid/checkin',
    'https://example.com/invite',
  ])
    assert.equal(isPreviewDestination(url), true);
  assert.equal(isPreviewDestination('https://wedding.real-domain.cn/checkin'), false);
  assert.match(artworkText('http://localhost:5173/checkin').notice, /请勿分发/);
  assert.equal(artworkText('https://wedding.real-domain.cn/checkin').opening, '12:08');
  assert.equal(escapeXml('<"&\'>'), '&lt;&quot;&amp;&apos;&gt;');
});

test('长专属链接自动选择安全码版，中心猫头区域不损坏定位/校正模块', async () => {
  const link = 'https://wedding.example.invalid/invite/' + 'a'.repeat(80);
  const matrix = catQrMatrix(link),
    center = matrix.size / 2;
  for (let y = 0; y < matrix.size; y++)
    for (let x = 0; x < matrix.size; x++)
      if (Math.hypot(x + 0.5 - center, y + 0.5 - center) < 4.6)
        assert.equal(matrix.isReserved(y, x), 0);
  const image = await qrPng(link, 512);
  const { data, info } = await sharp(image)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 512);
  // The four-module quiet zone must stay white, including every edge pixel.
  for (let x = 0; x < info.width; x++) {
    assert.deepEqual([...data.subarray(x * 3, x * 3 + 3)], [255, 255, 255]);
    const bottom = ((info.height - 1) * info.width + x) * 3;
    assert.deepEqual([...data.subarray(bottom, bottom + 3)], [255, 255, 255]);
  }
  await assert.rejects(qrPng(link, 32), /尺寸不足/);
});

test('海报与导视保持确认的窗棂合照及横幅取景，防止误复用页面照片', async () => {
  // Approved output geometry, independent of the renderer's photo configuration.
  const approvedPhoto = 'public/assets/wedding/couple-portrait.webp';
  for (const format of ['share', 'sign'] as const) {
    const frame =
      format === 'share'
        ? { left: 48, top: 136, width: 984, height: 1000 }
        : { left: 104, top: 288, width: 2192, height: 930 };
    const expected = sharp(approvedPhoto);
    if (format === 'sign') {
      const { width, height } = await expected.metadata();
      assert.ok(width && height);
      expected.extract({
        left: 0,
        top: Math.round((height * 260) / 1600),
        width,
        height: Math.round((height * 450) / 1600),
      });
    }
    const reference = await expected
      .resize(frame.width, frame.height, {
        fit: 'cover',
        position: format === 'sign' ? 'top' : 'centre',
      })
      .png()
      .toBuffer();
    const rendered =
      format === 'share'
        ? await renderPoster('http://localhost:5173/invite/private-test')
        : await renderCheckinDisplay('http://localhost:5173/checkin', 'sign');
    // Compare coarse RGB blocks inside the photo, excluding its rounded edge.
    // Tolerance allows librsvg/libvips resampling differences across platforms.
    const inset = 80,
      sampleSize = 32,
      tolerance = 4;
    const area = {
      left: inset,
      top: inset,
      width: frame.width - inset * 2,
      height: frame.height - inset * 2,
    };
    const a = await sharp(rendered)
      .extract({ ...area, left: frame.left + inset, top: frame.top + inset })
      .resize(sampleSize, sampleSize)
      .removeAlpha()
      .raw()
      .toBuffer();
    const b = await sharp(reference)
      .extract(area)
      .resize(sampleSize, sampleSize)
      .removeAlpha()
      .raw()
      .toBuffer();
    const difference =
      a.reduce((sum, value, index) => sum + Math.abs(value - b[index]), 0) / a.length;
    assert.ok(difference < tolerance, `${format} photo/crop drift: ${difference}`);
  }
});

test('物料圆角仅作用于外框，完整四模块方形静区仍为不透明白色', async () => {
  const text = 'https://wedding.example.invalid/invite/' + 'a'.repeat(80),
    size = 254;
  const n = catQrMatrix(text).size,
    cell = size / (n + 10);
  const { data } = await sharp(await qrPng(text, size, { roundedFrame: true }))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(data[3], 0, 'outer corner is transparent');
  const start = Math.ceil(cell),
    end = Math.floor(size - cell);
  const quietEnd = Math.floor(5 * cell),
    quietStart = Math.ceil((n + 5) * cell);
  for (let y = start; y < end; y++)
    for (let x = start; x < end; x++)
      if (x < quietEnd || x >= quietStart || y < quietEnd || y >= quietStart) {
        const pixel = (y * size + x) * 4;
        assert.deepEqual([...data.subarray(pixel, pixel + 4)], [255, 255, 255, 255]);
      }
});

test('三种版式保持独立像素规格与输出密度', async () => {
  const poster = await sharp(
    await renderPoster('http://localhost:5173/invite/private-test'),
  ).metadata();
  assert.equal(poster.width, 1080);
  assert.equal(poster.height, 1920);
  for (const format of ['table', 'sign'] as const) {
    const meta = await sharp(
      await renderCheckinDisplay('http://localhost:5173/checkin', format),
    ).metadata();
    assert.equal(meta.width, MEDIA_OUTPUTS[format].width);
    assert.equal(meta.height, MEDIA_OUTPUTS[format].height);
    assert.equal(meta.density, MEDIA_OUTPUTS[format].dpi);
  }
});

test('物料读取/下载仅管理员，原公共总码仍可无登录读取', async () => {
  for (const path of ['/materials', '/display?format=table']) {
    assert.equal((await app.request('/api/checkin' + path)).status, 401);
    assert.equal(
      (await app.request('/api/checkin' + path, { headers: { Cookie: staffCookie } })).status,
      403,
    );
  }
  const info = await app.request('/api/checkin/materials', { headers: { Cookie: adminCookie } });
  const body = (await info.json()) as { data: MediaOutputInfo };
  assert.equal(body.data.url, 'http://localhost:5173/checkin');
  assert.equal(body.data.preview, true);
  assert.equal(info.headers.get('cache-control'), 'no-store');
  for (const format of ['../../secret', 'toString', '__proto__', ''])
    assert.equal(
      (
        await app.request('/api/checkin/display?format=' + format, {
          headers: { Cookie: adminCookie },
        })
      ).status,
      400,
    );
  const image = await app.request('/api/checkin/display?format=table&download=1', {
    headers: { Cookie: adminCookie },
  });
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/png');
  assert.match(decodeURIComponent(image.headers.get('content-disposition')!), /签到桌牌-预览.png/);
  assert.equal(image.headers.get('cache-control'), 'no-store');
  assert.equal((await app.request('/api/checkin/qr')).status, 200);
  const qrDownload = await app.request('/api/checkin/qr?download=1');
  assert.equal(qrDownload.status, 200);
  assert.match(
    decodeURIComponent(qrDownload.headers.get('content-disposition')!),
    /签到二维码-预览.png/,
  );
});
