import assert from 'node:assert/strict';
import { scenario, row } from './fixture.mjs';

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
async function withoutRandomUUID(ctx) {
  await ctx.addInitScript(() => {
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      value: undefined,
      configurable: true,
    });
  });
}

scenario('UUID-01', '缺少randomUUID仍可登记，响应丢失后刷新重试复用原标识', async ({ create }) => {
  const ctx = await create();
  await withoutRandomUUID(ctx);
  const page = await ctx.newPage();
  const keys = [];
  await page.route('**/api/checkin/self', async (route) => {
    keys.push(route.request().postDataJSON().submissionKey);
    if (keys.length === 1) {
      await route.fetch();
      await route.abort('connectionreset');
    } else await route.continue();
  });
  await page.goto('/checkin');
  assert.equal(await page.evaluate(() => typeof globalThis.crypto.randomUUID), 'undefined');
  await page.locator('#checkin-name').fill('微信兼容重试');
  await page.getByRole('button', { name: '登记到场', exact: true }).click();
  await page.getByRole('button', { name: '重新提交', exact: true }).waitFor();
  assert.equal(row('SELECT count(*) AS n FROM checkins').n, 1);
  await page.reload();
  assert.equal(await page.locator('#checkin-name').inputValue(), '微信兼容重试');
  await page.getByRole('button', { name: '登记到场', exact: true }).click();
  await page.getByText('你已提交过登记', { exact: true }).waitFor();
  assert.equal(keys[0], keys[1]);
  assert.match(keys[0], uuidV4);
  assert.equal(row('SELECT count(*) AS n FROM checkins').n, 1);
  await page.getByRole('button', { name: '为另一位宾客登记', exact: true }).click();
  await page.locator('#checkin-name').fill('微信兼容重试');
  await page.getByRole('button', { name: '登记到场', exact: true }).click();
  await page.getByText('登记已提交', { exact: true }).waitFor();
  assert.match(keys[2], uuidV4);
  assert.notEqual(keys[2], keys[0]);
  assert.equal(row('SELECT count(*) AS n FROM checkins').n, 2);
});

scenario('UUID-02', '缺少randomUUID时手工补录、代登记与新增礼金均可提交', async ({ create }) => {
  const ctx = await create('admin');
  await withoutRandomUUID(ctx);
  const page = await ctx.newPage();
  const keys = [];
  page.on('request', (request) => {
    if (request.method() !== 'POST') return;
    const key = request.postDataJSON()?.submissionKey;
    if (key) keys.push(key);
  });
  await page.goto('/admin/review');
  await page.getByRole('button', { name: /查人 \/ 手动补录/ }).click();
  await page.locator('#guestName').fill('兼容手工补录');
  await page.getByText('本次新增独立档案，归入“临时到场”。', { exact: true }).waitFor();
  await page.getByRole('radio', { name: '仅签到，不登记礼金' }).check();
  await page.getByRole('button', { name: /仅确认到场$/ }).click();
  await page.locator('.review-drawer.ant-drawer-open').waitFor({ state: 'hidden' });
  assert.equal(row("SELECT count(*) AS n FROM checkins WHERE status='confirmed'").n, 1);
  await page.getByRole('button', { name: '扫码 / 代登记', exact: true }).click();
  await page.getByLabel('代登记来宾姓名').fill('兼容代登记');
  await page.getByRole('button', { name: '加入待审核', exact: true }).click();
  await page.waitForFunction(
    () => globalThis.document.querySelector('#pending-entry_name')?.value === '',
  );
  assert.equal(row("SELECT count(*) AS n FROM checkins WHERE status='pending'").n, 1);
  await page
    .getByRole('button', { name: /关\s*闭/ })
    .last()
    .click();
  await page.goto('/admin/gifts');
  await page.getByRole('button', { name: '新增礼金', exact: true }).click();
  await page.locator('#guestName').fill('兼容礼金');
  await page.locator('#amountYuan').fill('200');
  await page.getByRole('button', { name: '登记礼金', exact: true }).click();
  await page.locator('.gift-drawer.ant-drawer-open').waitFor({ state: 'hidden' });
  assert.equal(row('SELECT amount FROM gifts').amount, 20000);
  assert.equal(keys.length, 3);
  assert.equal(new Set(keys).size, 3);
  for (const key of keys) assert.match(key, uuidV4);
});

scenario(
  'UUID-03',
  '随机源不可用时显示提交失败并保留姓名，不产生未处理异常',
  async ({ create }) => {
    const ctx = await create();
    await withoutRandomUUID(ctx);
    await ctx.addInitScript(() => {
      Object.defineProperty(globalThis.crypto, 'getRandomValues', {
        value: undefined,
        configurable: true,
      });
    });
    const page = await ctx.newPage();
    await page.goto('/checkin');
    await page.locator('#checkin-name').fill('保留失败输入');
    await page.getByRole('button', { name: '登记到场', exact: true }).click();
    await page.getByRole('button', { name: '重新提交', exact: true }).waitFor();
    assert.equal(await page.locator('#checkin-name').inputValue(), '保留失败输入');
    assert.equal(row('SELECT count(*) AS n FROM checkins').n, 0);
  },
);
