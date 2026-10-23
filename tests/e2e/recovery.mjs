import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import { scenario, api, row } from './fixture.mjs';

scenario('CONFLICT-01', '两位管理员同时更正礼金，保留草稿并核对最新版本', async ({ create }) => {
  const { gift } = await import('./fixture.mjs');
  const a = await create('admin');
  const b = await create('admin');
  await gift(a);
  const pages = await Promise.all([a.newPage(), b.newPage()]);
  for (const page of pages) {
    await page.goto('/admin/gifts');
    await page.getByRole('button', { name: /更\s*正/, exact: true }).click();
    await page.getByRole('checkbox', { name: '金额录入有误', exact: true }).click();
  }
  await pages[0].locator('#amountYuan').fill('888');
  await pages[1].locator('#amountYuan').fill('999');
  await pages[0].getByRole('button', { name: '保存更正并留痕' }).click();
  await pages[0].locator('.gift-drawer.ant-drawer-open').waitFor({ state: 'hidden' });
  await pages[1].getByRole('button', { name: '保存更正并留痕' }).click();
  await pages[1].getByText('请先核对最新账目，你的草稿已保留', { exact: true }).waitFor();
  assert.equal(await pages[1].locator('#amountYuan').inputValue(), '999');
  assert.equal(row('SELECT amount FROM gifts').amount, 88800);
  await pages[1].getByRole('button', { name: '保留我的修改，载入最新记录核对' }).click();
  await pages[1].getByRole('button', { name: '保存更正并留痕' }).click();
  await pages[1].locator('.gift-drawer.ant-drawer-open').waitFor({ state: 'hidden' });
  assert.equal(row('SELECT amount FROM gifts').amount, 99900);
});

scenario('IMPORT-01', 'Excel部分成功逐行报告，并保留有效数据', async ({ create }) => {
  const ctx = await create('admin');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('导入验收');
  sheet.addRows([
    ['姓名', '手机号', '分组', '归属方'],
    ['导入有效宾客', '13800138000', '同学', '双方'],
    ['手机号错误', '12345', '同学', '男方'],
    ['', '13900139000', '亲友', '女方'],
  ]);
  const page = await ctx.newPage();
  await page.goto('/admin/guests');
  await page.locator('input[type=file]').setInputFiles({
    name: '一期宾客导入.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
  });
  await page.getByText('已导入1位，2行需处理', { exact: true }).filter({ visible: true }).waitFor();
  await page.getByText(/第3行：/).waitFor();
  await page.getByText(/第4行：/).waitFor();
  assert.equal(row('SELECT count(*) AS n FROM guests').n, 1);
  await page.getByRole('button', { name: '返回名单' }).click();
  await page.getByRole('button', { name: '导入有效宾客', exact: true }).waitFor();
});

scenario('GUARD-01', '未保存表单关闭保护、取消离开保留输入', async ({ create }) => {
  const ctx = await create('admin');
  const page = await ctx.newPage();
  await page.goto('/admin/guests');
  await page.getByRole('button', { name: '新增宾客', exact: true }).click();
  await page.locator('#name').fill('不可丢失的输入');
  await page
    .locator('.guest-drawer .ant-drawer-footer')
    .getByRole('button', { name: /关\s*闭/, exact: true })
    .click();
  await page.getByRole('button', { name: '继续填写', exact: true }).click();
  assert.equal(await page.locator('#name').inputValue(), '不可丢失的输入');
  await page
    .locator('.guest-drawer .ant-drawer-footer')
    .getByRole('button', { name: /关\s*闭/, exact: true })
    .click();
  await page.getByRole('button', { name: '丢弃输入并离开', exact: true }).click();
  await page.locator('.guest-drawer.ant-drawer-open').waitFor({ state: 'hidden' });
  assert.equal(row('SELECT count(*) AS n FROM guests').n, 0);
});

scenario('SSE-01', '现场审核断网期间提交，重连自动补齐队列', async ({ create }) => {
  const staff = await create('staff');
  const visitor = await create();
  const page = await staff.newPage();
  await page.goto('/admin/review');
  await page.getByText('当前没有待审提交', { exact: true }).waitFor();
  await staff.setOffline(true);
  await api(visitor, '/api/checkin/self', 'POST', {
    name: '断线期间到场',
    submissionKey: randomUUID(),
  });
  await staff.setOffline(false);
  await page
    .locator('.review-ticket')
    .filter({ hasText: '断线期间到场' })
    .waitFor({ timeout: 20000 });
  assert.equal(row('SELECT count(*) AS n FROM checkins').n, 1);
});

scenario('ASSET-01', '仪表盘动态资源失败提供恢复入口，恢复后能重新打开', async ({ create }) => {
  const ctx = await create('admin');
  const page = await ctx.newPage();
  let blocked = true;
  await page.route('**/assets/DashboardPage-*.js', (route) =>
    blocked ? route.abort('connectionreset') : route.continue(),
  );
  await page.goto('/admin');
  await page.getByRole('heading', { name: '页面资源加载失败', exact: true }).waitFor();
  blocked = false;
  await page.getByRole('button', { name: '重新加载页面', exact: true }).click();
  await page.locator('.dashboard-page').waitFor();
});
