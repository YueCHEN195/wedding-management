import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { scenario, capture } from './fixture.mjs';

scenario('PHOTO-01', '预览先显示，高清解码后替换且字节与原图一致', async ({ create }) => {
  const ctx = await create();
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  let releaseApi, releaseHigh;
  const apiGate = new Promise((done) => {
    releaseApi = done;
  });
  const highGate = new Promise((done) => {
    releaseHigh = done;
  });
  await page.route('**/api/invite/rsvp', async (route) => {
    await apiGate;
    await route.continue();
  });
  await page.route('**/optimized/couple-portrait-full-*', async (route) => {
    await highGate;
    await route.continue();
  });
  const requests = [];
  page.on('request', (request) => requests.push(request.url()));
  const previewResponse = page.waitForResponse((response) =>
    response.url().includes('/optimized/couple-portrait-preview-'),
  );
  const highRequest = page.waitForRequest((request) =>
    request.url().includes('/optimized/couple-portrait-full-'),
  );
  try {
    await page.goto('/invite', { waitUntil: 'domcontentloaded' });
    const response = await previewResponse;
    assert.ok((await response.body()).length < 5000);
    await highRequest;
    assert.equal(await page.locator('.invite-cover img').count(), 0, '预载不等待请柬接口');
    releaseApi();
    const image = page.locator('.invite-cover img');
    await image.waitFor();
    await image.evaluate((element) => element.decode());
    assert.equal(await image.getAttribute('data-photo-state'), 'preview');
    assert.match(await image.evaluate((element) => element.currentSrc), /couple-portrait-preview-/);
    assert.equal(await image.evaluate((element) => element.naturalWidth), 160);
    const bounds = await image.boundingBox();
    await capture(page, 'PHOTO-01-preview');
    const highResponse = page.waitForResponse((item) =>
      item.url().includes('/optimized/couple-portrait-full-'),
    );
    releaseHigh();
    const high = await highResponse;
    const original = await readFile(
      new URL('../../public/assets/wedding/couple-portrait.webp', import.meta.url),
    );
    const digest = (data) => createHash('sha256').update(data).digest('hex');
    assert.equal(digest(await high.body()), digest(original));
    await page.locator('.invite-cover img[data-photo-state=ready]').waitFor();
    await image.evaluate((element) => element.decode());
    assert.equal(await image.evaluate((element) => element.naturalWidth), 1280);
    assert.deepEqual(await image.boundingBox(), bounds, '换图不改变尺寸和位置');
    assert.equal(
      requests.filter((url) => url.includes('/optimized/couple-portrait-full-')).length,
      1,
    );
    assert.equal(
      requests.filter((url) => url.includes('/optimized/couple-portrait-preview-')).length,
      1,
    );
    await capture(page, 'PHOTO-01-original-quality');
    await page.getByRole('button', { name: /打开请柬/ }).click();
    await page.getByText('影像与故事', { exact: true }).click();
    for (const gallery of await page.locator('.invite-gallery img').all()) {
      await gallery.scrollIntoViewIfNeeded();
      await page.waitForFunction(
        (element) => element?.dataset.photoState === 'ready',
        await gallery.elementHandle(),
      );
      await gallery.evaluate((element) => element.decode());
      assert.match(await gallery.evaluate((element) => element.currentSrc), /-full-/);
    }
    assert.equal(
      requests.filter((url) => url.includes('/optimized/couple-portrait-full-')).length,
      1,
      '相册复用已加载的封面高清，不重复下载',
    );
  } finally {
    releaseApi();
    releaseHigh();
  }
});

scenario('PHOTO-02', '高清缓存复用，登录不抢载，缺失文件不长期缓存', async ({ create }) => {
  const ctx = await create();
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/invite');
  await page.locator('.invite-cover img[data-photo-state=ready]').waitFor();
  const src = await page.locator('.invite-cover img').evaluate((element) => element.currentSrc);
  const response = await ctx.request.get(src);
  assert.match(response.headers()['cache-control'], /max-age=31536000, immutable/);
  await page.goto('/invite?cache-check=2');
  await page.locator('.invite-cover img[data-photo-state=ready]').waitFor();
  const timing = await page.evaluate((url) => {
    const resource = globalThis.performance.getEntriesByName(url).at(-1);
    return { transfer: resource?.transferSize, decoded: resource?.decodedBodySize };
  }, src);
  assert.equal(timing.transfer, 0, JSON.stringify(timing));
  assert.ok(timing.decoded > 0);
  const missing = await ctx.request.get('/assets/wedding/optimized/missing.webp');
  assert.ok(!missing.headers()['cache-control']?.includes('immutable'));
  const login = await ctx.newPage();
  await login.goto('/login');
  await login.getByLabel('账号').waitFor();
  assert.equal(await login.locator('link[rel=preload][as=image]').count(), 0);
});

scenario('PHOTO-03', '高清加载失败时保留已经可见的预览', async ({ create }) => {
  const ctx = await create();
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/optimized/couple-portrait-full-*', (route) =>
    route.abort('connectionreset'),
  );
  await page.goto('/invite');
  const image = page.locator('.invite-cover img[data-photo-state=preview-only]');
  await image.waitFor();
  await image.evaluate((element) => element.decode());
  assert.equal(await image.evaluate((element) => element.naturalWidth), 160);
  assert.match(await image.evaluate((element) => element.currentSrc), /-preview-/);
  await capture(page, 'PHOTO-03-preview-retained');
  await page.getByRole('button', { name: /打开请柬/ }).click();
  await page.locator('.invite-content').waitFor();
});

scenario('PHOTO-04', '预览失败仍可显示高清，两者失败时使用原文字回退', async ({ create }) => {
  const ctx = await create();
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/optimized/couple-portrait-preview-*', (route) =>
    route.abort('connectionreset'),
  );
  await page.goto('/invite');
  const image = page.locator('.invite-cover img[data-photo-state=ready]');
  await image.waitFor();
  await image.evaluate((element) => element.decode());
  assert.equal(await image.evaluate((element) => element.naturalWidth), 1280);
  await page.route('**/optimized/couple-portrait-full-*', (route) =>
    route.abort('connectionreset'),
  );
  await page.reload();
  await page.locator('.invite-placeholder').waitFor();
  await page.getByRole('button', { name: /打开请柬/ }).waitFor();
});

scenario('PHOTO-05', '不支持decode的内核在高清load后正常替换', async ({ create }) => {
  const ctx = await create();
  await ctx.addInitScript(() => {
    Object.defineProperty(globalThis.HTMLImageElement.prototype, 'decode', {
      value: undefined,
      configurable: true,
    });
  });
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/invite');
  await page.locator('.invite-cover img[data-photo-state=ready]').waitFor();
  await page.waitForFunction(
    () => globalThis.document.querySelector('.invite-cover img')?.naturalWidth === 1280,
  );
  assert.match(
    await page.locator('.invite-cover img').evaluate((element) => element.currentSrc),
    /-full-/,
  );
});
