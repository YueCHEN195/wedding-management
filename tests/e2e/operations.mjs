import assert from 'node:assert/strict';
import { scenario, guest, manual, rows, row, capture } from './fixture.mjs';

scenario('RSVP-01', '专属回执保存修改及通用同名会话隔离', async ({ create }) => {
  const admin = await create('admin');
  const record = await guest(admin, '专属邀请验收');
  const visitor = await create();
  const page = await visitor.newPage();
  const { openRsvp } = await import('./fixture.mjs');
  await openRsvp(page, `/invite/${record.inviteToken}`);
  await page.getByRole('radio', { name: '欣然赴约' }).check();
  await page.getByRole('button', { name: '增加出席人数', exact: true }).click();
  await page.locator('#rsvp-message').fill('祝新婚快乐，一路相伴！');
  await page.getByRole('button', { name: '保存回执', exact: true }).click();
  await page.getByText('回执已保存', { exact: true }).waitFor();
  assert.equal(row('SELECT guest_id AS id FROM rsvps').id, record.id);
  const expected = row('SELECT headcount FROM rsvps').headcount;
  await page.getByRole('button', { name: '修改回执', exact: true }).click();
  await page.getByRole('button', { name: '增加出席人数', exact: true }).click();
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await page.getByText('回执已保存', { exact: true }).waitFor();
  assert.equal(row('SELECT count(*) AS n FROM rsvps').n, 1);
  assert.equal(row('SELECT headcount FROM rsvps').headcount, expected + 1);
  for (const message of ['甲的祝福', '乙的祝福']) {
    const ctx = await create();
    const universal = await ctx.newPage();
    await openRsvp(universal, '/invite');
    await universal.locator('#rsvp-name').fill('同名回执宾客');
    await universal.getByRole('radio', { name: '欣然赴约' }).check();
    await universal.locator('#rsvp-message').fill(message);
    await universal.getByRole('button', { name: '保存回执', exact: true }).click();
    await universal.getByText('回执已保存', { exact: true }).waitFor();
  }
  assert.deepEqual(
    rows('SELECT message FROM rsvps WHERE guest_name = ? ORDER BY id', '同名回执宾客').map(
      (item) => item.message,
    ),
    ['甲的祝福', '乙的祝福'],
  );
  await capture(page, 'RSVP-01-saved');
});

scenario('GIFT-01', '实际页面登记礼金、必填原因和快捷更正', async ({ create }) => {
  const ctx = await create('admin');
  const page = await ctx.newPage();
  await page.goto('/admin/gifts');
  await page.getByRole('button', { name: '新增礼金', exact: true }).click();
  await page.locator('#guestName').fill('礼金页面验收');
  await page.locator('#amountYuan').fill('600.50');
  await page.getByRole('button', { name: '登记礼金', exact: true }).click();
  await page.locator('.gift-drawer.ant-drawer-open').waitFor({ state: 'hidden' });
  assert.equal(row('SELECT amount FROM gifts').amount, 60050);
  await page.getByRole('button', { name: /更\s*正/, exact: true }).click();
  await page.locator('#amountYuan').fill('888');
  await page.getByRole('button', { name: '保存更正并留痕', exact: true }).click();
  await page.locator('.ant-form-item-explain-error').waitFor();
  assert.equal(row('SELECT amount FROM gifts').amount, 60050);
  await page.getByRole('checkbox', { name: '金额录入有误', exact: true }).click();
  assert.equal(await page.locator('#reason').inputValue(), '金额录入有误');
  await page.getByRole('button', { name: '保存更正并留痕', exact: true }).click();
  await page.locator('.gift-drawer.ant-drawer-open').waitFor({ state: 'hidden' });
  assert.equal(row('SELECT amount FROM gifts').amount, 88800);
  assert.ok(row('SELECT count(*) AS n FROM operation_logs').n >= 2);
});

scenario('INLINE-01', '现场审核原页更正人数、礼金与撤销确认', async ({ create }) => {
  const ctx = await create('admin');
  await manual(ctx, '原页更正验收', { amount: 60000 });
  const page = await ctx.newPage();
  await page.goto('/admin/review');
  await page.locator('.review-directory-name').filter({ hasText: '原页更正验收' }).click();
  await page.getByRole('button', { name: '更正人数', exact: true }).click();
  await page.locator('#actualHeadcountInput').fill('4');
  await page.getByRole('checkbox', { name: '现场重新清点人数', exact: true }).click();
  await page.getByRole('button', { name: '保存人数', exact: true }).click();
  await page.locator('.checkin-drawer.ant-drawer-open').waitFor({ state: 'hidden' });
  assert.equal(row('SELECT actual_headcount AS n FROM checkins').n, 4);
  assert.ok(page.url().endsWith('/admin/review'));
  await page.getByRole('button', { name: '更正礼金', exact: true }).click();
  await page.locator('#amountYuan').fill('900');
  await page.getByRole('checkbox', { name: '现场重新核对红包', exact: true }).click();
  await page.getByRole('button', { name: '保存更正并留痕', exact: true }).click();
  await page.locator('.gift-drawer.ant-drawer-open').waitFor({ state: 'hidden' });
  assert.equal(row('SELECT amount FROM gifts').amount, 90000);
  assert.ok(page.url().endsWith('/admin/review'));
  await page.getByRole('button', { name: '撤销签到确认', exact: true }).click();
  const modal = page.getByRole('dialog', { name: '撤销确认', exact: true });
  await modal.getByRole('checkbox', { name: '误确认签到', exact: true }).click();
  await modal.getByRole('button', { name: '撤销确认', exact: true }).click();
  await modal.waitFor({ state: 'hidden' });
  assert.equal(row('SELECT status FROM checkins').status, 'cancelled');
  assert.equal(row('SELECT amount FROM gifts').amount, 90000);
  assert.equal(row('SELECT status FROM guests').status, 'pending');
});

scenario('STATES-01', '表格内部空态、接口失败和手动刷新恢复', async ({ create }) => {
  const ctx = await create('admin');
  const page = await ctx.newPage();
  await page.goto('/admin/review');
  const empty = page.locator('.review-directory .ant-empty');
  await empty.waitFor();
  assert.ok(await empty.evaluate((element) => element.closest('td') != null));
  await guest(ctx, '刷新恢复验收');
  let failed = true;
  await page.route('**/api/guests?*', (route) =>
    failed
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: false,
            error: { code: 'UNAVAILABLE', message: '测试连接暂时中断' },
          }),
        })
      : route.continue(),
  );
  await page.goto('/admin/guests');
  await page.getByText('宾客名单加载失败', { exact: true }).waitFor();
  failed = false;
  await page.getByRole('button', { name: /重\s*试/, exact: true }).click();
  await page.getByRole('button', { name: '刷新恢复验收', exact: true }).waitFor();
  await capture(page, 'STATES-01-restored');
});
