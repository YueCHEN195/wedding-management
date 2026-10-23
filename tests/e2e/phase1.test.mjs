import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import { scenario, api, guest, manual, rows, row, capture, noOverflow } from './fixture.mjs';

scenario('AUTH-01', '真实登录、错误密码与工作人员权限', async ({ create }) => {
  const anonymous = await create();
  const page = await anonymous.newPage();
  await page.goto('/login');
  await page.getByLabel('账号').fill('phase1-admin');
  await page.getByLabel('密码').fill('incorrect');
  await page.getByRole('button', { name: /进入管理后台/ }).click();
  await page.getByText('账号或密码错误', { exact: true }).waitFor();
  await page.getByLabel('密码').fill('Phase1-Test-Only!');
  await page.getByRole('button', { name: /进入管理后台/ }).click();
  await page.waitForURL('**/admin');
  await page.locator('.dashboard-page').waitFor();
  const staff = await create('staff');
  for (const path of ['/api/rsvps', '/api/stats/summary', '/api/export/guests']) {
    assert.equal((await staff.request.get(path)).status(), 403, path);
  }
  const admin = await create('admin');
  const record = await guest(admin, '隐私验收', { phone: '13800138000', note: '私密备注' });
  const detail = await api(staff, `/api/guests/${record.id}/detail`);
  assert.ok(!JSON.stringify(detail).includes('13800138000'));
  assert.ok(!JSON.stringify(detail).includes('私密备注'));
  const staffPage = await staff.newPage();
  await staffPage.goto('/admin/rsvps');
  await staffPage.waitForURL('**/admin/review');
  await capture(staffPage, 'AUTH-01-staff');
});

scenario('GUEST-01', '新增宾客手机号校验和自定义分组', async ({ create }) => {
  const ctx = await create('admin');
  const page = await ctx.newPage();
  await page.goto('/admin/guests');
  await page.getByRole('button', { name: '新增宾客', exact: true }).click();
  await page.locator('#name').fill('张晓明');
  await page.locator('#phone').fill('12345678901');
  await page.getByRole('button', { name: '保存宾客', exact: true }).click();
  await page.locator('.ant-form-item-explain-error').waitFor();
  assert.equal(row('SELECT count(*) AS n FROM guests').n, 0);
  assert.equal(await page.locator('#phone').getAttribute('autocomplete'), 'off');
  await page.locator('#phone').fill('13800138000');
  await page.locator('#groupName').fill('大学同学');
  await page.getByRole('button', { name: '保存宾客', exact: true }).click();
  await page.locator('.ant-drawer-open').waitFor({ state: 'hidden' });
  assert.equal(row('SELECT group_name AS value FROM guests').value, '大学同学');
  await page.getByRole('button', { name: '新增宾客', exact: true }).click();
  await page.locator('#groupName').click();
  await page.locator('.ant-select-item-option').filter({ hasText: '大学同学' }).click();
  assert.equal(await page.locator('#groupName').inputValue(), '大学同学');
  await capture(page, 'GUEST-01-group');
});

scenario('ONSITE-01', '宾客登记、真实实时队列、工作人员确认与临时分组', async ({ create }) => {
  const staff = await create('staff');
  const desk = await staff.newPage();
  await desk.goto('/admin/review');
  await desk.getByText('当前没有待审提交', { exact: true }).waitFor();
  const visitor = await create();
  const page = await visitor.newPage();
  await page.goto('/checkin');
  await page.locator('#checkin-name').fill('现场新宾客');
  const started = Date.now();
  await page.getByRole('button', { name: '登记到场', exact: true }).click();
  await page.getByText('登记已提交', { exact: true }).waitFor();
  const ticket = desk.locator('.review-ticket').filter({ hasText: '现场新宾客' });
  await ticket.waitFor({ timeout: 4500 });
  assert.ok(Date.now() - started < 5000, '实时队列更新超过5秒');
  await ticket.click();
  assert.equal(await desk.locator('#groupName').count(), 0);
  await desk.locator('#actualHeadcountInput').fill('3');
  await desk.locator('#actualChildrenInput').fill('1');
  await desk.getByRole('radio', { name: '仅签到，不登记礼金' }).check();
  await desk.getByRole('button', { name: '仅确认到场', exact: true }).click();
  await desk.locator('.review-drawer.ant-drawer-open').waitFor({ state: 'hidden' });
  assert.equal(row('SELECT status FROM checkins').status, 'confirmed');
  assert.equal(row('SELECT group_name AS value FROM guests').value, '临时到场');
  assert.equal(row('SELECT actual_headcount AS n FROM checkins').n, 3);
  assert.equal(row('SELECT count(*) AS n FROM gifts').n, 0);
  await capture(desk, 'ONSITE-01-confirmed');
});

scenario('RETRY-01', '服务端已落库但响应丢失后的刷新重试不重复登记', async ({ create }) => {
  const ctx = await create();
  const page = await ctx.newPage();
  let interrupted = false;
  await page.route('**/api/checkin/self', async (route) => {
    if (route.request().method() === 'POST' && !interrupted) {
      interrupted = true;
      await route.fetch();
      await route.abort('connectionreset');
    } else await route.continue();
  });
  await page.goto('/checkin');
  await page.locator('#checkin-name').fill('断网重试宾客');
  await page.getByRole('button', { name: '登记到场', exact: true }).click();
  await page.getByRole('button', { name: '重新提交', exact: true }).waitFor();
  assert.equal(row('SELECT count(*) AS n FROM checkins').n, 1);
  await page.reload();
  assert.equal(await page.locator('#checkin-name').inputValue(), '断网重试宾客');
  await page.getByRole('button', { name: '登记到场', exact: true }).click();
  await page.getByText('你已提交过登记', { exact: true }).waitFor();
  assert.equal(row('SELECT count(*) AS n FROM checkins').n, 1);
  await page.getByRole('button', { name: '为另一位宾客登记', exact: true }).click();
  await page.locator('#checkin-name').fill('断网重试宾客');
  await page.getByRole('button', { name: '登记到场', exact: true }).click();
  await page.getByText('登记已提交', { exact: true }).waitFor();
  assert.equal(row('SELECT count(*) AS n FROM checkins').n, 2);
});

scenario('SAME-01', '同名宾客按独立ID关联，重复幂等键不再记账', async ({ create }) => {
  const ctx = await create('admin');
  const first = await guest(ctx, '王伟');
  const second = await guest(ctx, '王伟');
  const key = randomUUID();
  const payload = {
    guestName: '王伟',
    guestId: first.id,
    actualHeadcount: 2,
    actualChildrenCount: 1,
    amount: 10000,
    submissionKey: key,
  };
  await api(ctx, '/api/checkins', 'POST', payload);
  await api(ctx, '/api/checkins', 'POST', payload);
  await manual(ctx, '王伟', { guestId: second.id });
  assert.equal(rows('SELECT id FROM checkins').length, 2);
  assert.equal(rows('SELECT id FROM gifts').length, 1);
  assert.deepEqual(
    rows('SELECT guest_id AS id FROM checkins ORDER BY id').map((item) => item.id),
    [first.id, second.id],
  );
  const page = await ctx.newPage();
  await page.goto('/admin/review');
  await page.locator('.review-directory-name').filter({ hasText: '王伟' }).first().waitFor();
  assert.equal(await page.locator('.review-directory-name').filter({ hasText: '王伟' }).count(), 2);
});

scenario('EXPORT-01', '实际Excel文件、二维码PNG与权限', async ({ create }) => {
  const ctx = await create('admin');
  await guest(ctx, '导出长姓名·张小明', { phone: '13800138000' });
  await manual(ctx, '导出来宾', { amount: 12345, actualHeadcount: 3, actualChildrenCount: 1 });
  for (const kind of ['guests', 'rsvps', 'checkins', 'gifts']) {
    const response = await ctx.request.get(`/api/export/${kind}`);
    assert.equal(response.status(), 200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await response.body());
    assert.equal(workbook.worksheets.length, 1);
    assert.ok(workbook.worksheets[0].rowCount >= 1);
    if (kind === 'gifts')
      assert.ok(JSON.stringify(workbook.worksheets[0].getSheetValues()).includes('123.45'));
  }
  const qr = await ctx.request.get('/api/checkin/qr');
  assert.equal(qr.status(), 200);
  assert.equal((await qr.body()).subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
});

scenario('LAYOUT-01', '所有后台真实页面桌面、短窗口和窄屏无横向溢出', async ({ create }) => {
  const ctx = await create('admin');
  await guest(ctx, '长姓名验收'.repeat(6), {
    groupName: '长分组名称'.repeat(6),
    note: '长备注'.repeat(100),
  });
  await manual(ctx, '已签到验收');
  const page = await ctx.newPage();
  for (const size of [
    { width: 1440, height: 900 },
    { width: 1280, height: 640 },
    { width: 390, height: 640 },
  ]) {
    await page.setViewportSize(size);
    for (const path of [
      '/admin',
      '/admin/guests',
      '/admin/rsvps',
      '/admin/review',
      '/admin/checkins',
      '/admin/gifts',
      '/admin/export',
    ]) {
      await page.goto(path);
      await page.locator('.ant-layout-content').waitFor();
      await page.getByText('加载中…', { exact: true }).waitFor({ state: 'hidden' });
      await noOverflow(page);
      if (path === '/admin/review') await capture(page, `LAYOUT-01-review-${size.width}`);
    }
  }
});

await import('./operations.mjs');
await import('./recovery.mjs');
await import('./lifecycle.mjs');
