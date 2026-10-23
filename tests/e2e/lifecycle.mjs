import assert from 'node:assert/strict';
import { scenario, api, guest, manual, row, legacy, capture } from './fixture.mjs';

scenario('ARCHIVE-01', '已出席宾客菜单、归档与恢复保留签到礼金', async ({ create }) => {
  const ctx = await create('admin');
  const checkin = await manual(ctx, '归档现场宾客', { amount: 60000 });
  const page = await ctx.newPage();
  await page.goto('/admin/guests');
  await page.getByRole('button', { name: /归档现场宾客 #\d+ 的更多操作/ }).click();
  assert.deepEqual(await page.locator('.ant-dropdown').getByRole('menuitem').allTextContents(), [
    '操作记录',
    '归档宾客',
  ]);
  await page.getByRole('menuitem', { name: '归档宾客' }).click();
  let modal = page.getByRole('dialog', { name: '归档宾客', exact: true });
  await modal.getByRole('checkbox', { name: '名单整理归档', exact: true }).click();
  await modal.getByRole('button', { name: '归档宾客', exact: true }).click();
  await modal.waitFor({ state: 'hidden' });
  assert.ok(row('SELECT archived_at AS value FROM guests').value);
  assert.equal(row('SELECT status FROM checkins WHERE id = ?', checkin.id).status, 'confirmed');
  assert.equal((await api(ctx, '/api/stats/summary')).giftTotal, 60000);
  await page.getByRole('tab', { name: '已归档宾客', exact: true }).click();
  await page.getByRole('button', { name: /归档现场宾客 #\d+ 的更多操作/ }).click();
  await page.getByRole('menuitem', { name: '恢复宾客' }).click();
  modal = page.getByRole('dialog', { name: '恢复记录', exact: true });
  await modal.getByRole('checkbox', { name: '误操作恢复' }).click();
  await modal.getByRole('button', { name: '恢复记录', exact: true }).click();
  await modal.waitFor({ state: 'hidden' });
  assert.equal(row('SELECT archived_at AS value FROM guests').value, null);
});

scenario('VOID-01', '作废礼金退出有效汇总但保留金额和签到关联', async ({ create }) => {
  const ctx = await create('admin');
  const checkin = await manual(ctx, '作废礼金验收', { amount: 10000 });
  const page = await ctx.newPage();
  await page.goto('/admin/gifts');
  await page.getByRole('button', { name: /作废礼金验收 礼金#\d+ 的更多操作/ }).click();
  await page.getByRole('menuitem', { name: '作废礼金' }).click();
  const modal = page.getByRole('dialog', { name: '作废礼金', exact: true });
  await modal.getByRole('checkbox', { name: '重复登记礼金' }).click();
  await modal.getByRole('button', { name: '作废礼金', exact: true }).click();
  await modal.waitFor({ state: 'hidden' });
  const saved = row('SELECT amount, checkin_id AS checkinId, voided_at AS voidedAt FROM gifts');
  assert.equal(saved.amount, 10000);
  assert.equal(saved.checkinId, checkin.id);
  assert.ok(saved.voidedAt);
  assert.equal((await api(ctx, '/api/stats/summary')).giftTotal, 0);
  assert.equal(row('SELECT status FROM checkins').status, 'confirmed');
});

scenario('CONTEXT-01', '查看详情和刷新数据保留分页上下文', async ({ create }) => {
  const ctx = await create('admin');
  for (let i = 1; i <= 15; i++) await guest(ctx, `分页宾客${i}`);
  const page = await ctx.newPage();
  await page.goto('/admin/guests');
  await page.locator('.ant-pagination-item-2').click();
  await page.locator('.ant-pagination-item-2.ant-pagination-item-active').waitFor();
  await page.locator('.guest-name-cell').first().click();
  await page
    .locator('.guest-drawer .ant-drawer-footer')
    .getByRole('button', { name: /关\s*闭/, exact: true })
    .click();
  await page.locator('.guest-drawer.ant-drawer-open').waitFor({ state: 'hidden' });
  await page.locator('.ant-pagination-item-2.ant-pagination-item-active').waitFor();
  await page.getByRole('button', { name: '刷新数据', exact: true }).click();
  await page.locator('.ant-pagination-item-2.ant-pagination-item-active').waitFor();
  assert.equal(await page.locator('.ant-table-row').count(), 5);
});

scenario('UNKNOWN-01', '历史未知人数明确待补记，不伪造零人', async ({ create }) => {
  const ctx = await create('admin');
  const record = await manual(ctx, '历史未知人数');
  legacy(
    'UPDATE checkins SET actual_headcount = NULL, actual_children_count = NULL WHERE id = ?',
    record.id,
  );
  const summary = await api(ctx, '/api/stats/summary');
  assert.equal(summary.unknownHeadcountGroups, 1);
  const page = await ctx.newPage();
  await page.goto('/admin/review');
  await page.locator('.review-directory-name').filter({ hasText: '历史未知人数' }).click();
  await page.getByRole('dialog').getByText('待补记', { exact: true }).waitFor();
  await page.getByRole('button', { name: '补记人数', exact: true }).waitFor();
  await capture(page, 'UNKNOWN-01-detail');
});

scenario('SAME-02', '同名候选全部已签到，手工补录默认新增独立身份', async ({ create }) => {
  const ctx = await create('admin');
  const first = await guest(ctx, '同名现场宾客');
  const second = await guest(ctx, '同名现场宾客');
  await manual(ctx, '同名现场宾客', { guestId: first.id });
  await manual(ctx, '同名现场宾客', { guestId: second.id });
  const page = await ctx.newPage();
  await page.goto('/admin/review');
  await page.getByRole('button', { name: /查人 \/ 手动补录/ }).click();
  await page.locator('#guestName').fill('同名现场宾客');
  await page.getByText('本次新增独立档案，归入“临时到场”。', { exact: true }).waitFor();
  await page.getByRole('radio', { name: '仅签到，不登记礼金' }).check();
  await page.getByRole('button', { name: '仅确认到场', exact: true }).click();
  await page.locator('.review-drawer.ant-drawer-open').waitFor({ state: 'hidden' });
  assert.equal(row('SELECT count(*) AS n FROM guests').n, 3);
  assert.equal(row('SELECT count(*) AS n FROM checkins').n, 3);
});
