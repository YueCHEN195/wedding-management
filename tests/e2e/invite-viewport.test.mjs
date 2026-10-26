import assert from 'node:assert/strict';
import { scenario, capture } from './fixture.mjs';

scenario(
  'INVITE-VIEWPORT-01',
  '触屏请柬不强制滚动条占位，封面与视口边缘一致',
  async ({ create }) => {
    const ctx = await create();
    const page = await ctx.newPage();
    const device = await ctx.newCDPSession(page);
    await device.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    for (const size of [
      { width: 390, height: 844 },
      { width: 360, height: 640 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(size);
      await page.goto('/invite');
      await page.getByRole('button', { name: /打开请柬/ }).waitFor();
      const geometry = await page.evaluate(() => {
        const scroll = globalThis.document.querySelector('.invite-scroll');
        const cover = globalThis.document.querySelector('.invite-cover');
        const main = globalThis.document.querySelector('.guest-invite');
        const style = globalThis.getComputedStyle(scroll);
        return {
          touch: globalThis.matchMedia('(pointer: coarse)').matches,
          scrollbarWidth: style.scrollbarWidth,
          customScrollbarWidth: globalThis.getComputedStyle(scroll, '::-webkit-scrollbar').width,
          coverRight: cover.getBoundingClientRect().right,
          scrollRight: scroll.getBoundingClientRect().right,
          viewportWidth: globalThis.innerWidth,
          mainHeight: main.getBoundingClientRect().height,
          viewportHeight: globalThis.visualViewport.height,
        };
      });
      assert.ok(geometry.touch);
      assert.equal(geometry.scrollbarWidth, 'auto');
      assert.equal(geometry.customScrollbarWidth, 'auto');
      assert.ok(
        Math.abs(geometry.scrollRight - geometry.viewportWidth) <= 1,
        JSON.stringify(geometry),
      );
      assert.ok(
        Math.abs(geometry.mainHeight - geometry.viewportHeight) <= 1,
        JSON.stringify(geometry),
      );
      if (size.width <= 600)
        assert.ok(
          Math.abs(geometry.coverRight - geometry.viewportWidth) <= 1,
          JSON.stringify(geometry),
        );
      await capture(page, `INVITE-VIEWPORT-01-${size.width}`);
      await page.getByRole('button', { name: /打开请柬/ }).click();
      await page.locator('.guest-invite[data-actions-ready="true"]').waitFor();
      await page.getByRole('button', { name: '填写回执', exact: true }).click();
      await page.locator('.rsvp-form').waitFor();
      await page.locator('#rsvp-name').fill('触屏验收');
      await page.locator('#rsvp-message').fill('输入后旋转屏幕仍保留');
      await page.setViewportSize({ width: size.height, height: size.width });
      assert.equal(await page.locator('#rsvp-name').inputValue(), '触屏验收');
      assert.equal(await page.locator('#rsvp-message').inputValue(), '输入后旋转屏幕仍保留');
    }
  },
);

scenario(
  'INVITE-VIEWPORT-02',
  '无VisualViewport时使用窗口高度，失败页面可重试',
  async ({ create }) => {
    const ctx = await create();
    await ctx.addInitScript(() => {
      Object.defineProperty(globalThis, 'visualViewport', { value: undefined, configurable: true });
    });
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 390, height: 720 });
    let failure = true;
    await page.route('**/api/invite/rsvp', (route) =>
      failure
        ? route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({
              ok: false,
              error: { code: 'UNAVAILABLE', message: '连接暂时中断' },
            }),
          })
        : route.continue(),
    );
    await page.goto('/invite');
    await page.getByRole('heading', { name: '暂时无法加载请柬' }).waitFor();
    failure = false;
    await page.getByRole('button', { name: '重新加载', exact: true }).click();
    await page.getByRole('button', { name: /打开请柬/ }).waitFor();
    await page.waitForFunction(
      () =>
        globalThis.document
          .querySelector('.guest-invite')
          .style.getPropertyValue('--invite-visible-height') === `${globalThis.innerHeight}px`,
    );
    await page.setViewportSize({ width: 390, height: 640 });
    await page.waitForFunction(
      () =>
        globalThis.document
          .querySelector('.guest-invite')
          .style.getPropertyValue('--invite-visible-height') === `${globalThis.innerHeight}px`,
    );
    await capture(page, 'INVITE-VIEWPORT-02-no-visual-viewport');
  },
);
