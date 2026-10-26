import assert from 'node:assert/strict';
import { scenario, api, guest, gift, manual, row, capture, noOverflow } from './fixture.mjs';

async function openDetails(page, record) {
  await page.goto('/admin/review');
  await page
    .locator('.review-directory-name')
    .filter({ hasText: `#${record.guestId} ·` })
    .click();
}
async function lifecycle(page, label, reason) {
  const modal = page.getByRole('dialog', { name: label, exact: true });
  await modal.getByRole('checkbox', { name: reason, exact: true }).click();
  await modal.getByRole('button', { name: label, exact: true }).click();
  await modal.waitFor({ state: 'hidden' });
}

scenario(
  'CORRECT-01',
  'staff原页更正人数礼金、补礼金、作废恢复、撤销恢复及短窄窗口',
  async ({ create }) => {
    const admin = await create('admin');
    const record = await manual(admin, '工作人员现场纠错', { amount: 60000 });
    const giftId = row('SELECT id FROM gifts WHERE checkin_id=?', record.id).id;
    const staff = await create('staff');
    const page = await staff.newPage();
    await openDetails(page, record);
    await page.setViewportSize({ width: 390, height: 600 });
    assert.equal(await page.getByRole('button', { name: '编辑档案', exact: true }).count(), 0);
    assert.equal(await page.getByText(/有效合计/).count(), 0);
    await page.getByRole('button', { name: '更正人数', exact: true }).click();
    await page.locator('#actualHeadcountInput').fill('4');
    await page.locator('#actualChildrenInput').fill('1');
    await page.getByRole('checkbox', { name: '同行家人晚到', exact: true }).click();
    await page.getByRole('button', { name: '保存人数', exact: true }).click();
    await page.locator('.checkin-drawer.ant-drawer-open').waitFor({ state: 'hidden' });
    assert.equal(row('SELECT actual_headcount AS n FROM checkins WHERE id=?', record.id).n, 4);
    await page.getByRole('button', { name: '更正礼金', exact: true }).click();
    await page.locator('#amountYuan').fill('800');
    await page.getByRole('checkbox', { name: '金额录入有误', exact: true }).click();
    await page.getByRole('button', { name: '保存更正并留痕', exact: true }).click();
    await page.locator('.gift-drawer.ant-drawer-open').waitFor({ state: 'hidden' });
    assert.equal(row('SELECT amount FROM gifts WHERE id=?', giftId).amount, 80000);
    await page.getByRole('button', { name: '补登记礼金', exact: true }).click();
    assert.equal(await page.locator('#guestName').isDisabled(), true);
    await page.locator('#amountYuan').fill('200');
    await page.getByRole('button', { name: '登记礼金', exact: true }).click();
    await page.locator('.gift-drawer.ant-drawer-open').waitFor({ state: 'hidden' });
    assert.equal(row('SELECT count(*) AS n FROM gifts').n, 2);
    assert.equal(row('SELECT count(*) AS n FROM checkins').n, 1);
    const giftCard = page.locator('.guest-detail-record').filter({ hasText: `礼金 #${giftId} ·` });
    await giftCard.getByRole('button', { name: '作废礼金', exact: true }).click();
    await lifecycle(page, '作废礼金', '重复登记礼金');
    assert.ok(row('SELECT voided_at AS time FROM gifts WHERE id=?', giftId).time);
    await giftCard.getByRole('button', { name: '恢复礼金', exact: true }).click();
    await lifecycle(page, '恢复记录', '误操作恢复');
    assert.equal(row('SELECT voided_at AS time FROM gifts WHERE id=?', giftId).time, null);
    await page.getByRole('button', { name: '处理错误登记', exact: true }).click();
    await page.getByRole('menuitem', { name: '撤销签到确认', exact: true }).click();
    await lifecycle(page, '撤销确认', '误确认签到');
    assert.equal(row('SELECT status FROM checkins WHERE id=?', record.id).status, 'cancelled');
    assert.equal(row('SELECT count(*) AS n FROM gifts WHERE voided_at IS NULL').n, 2);
    await page.getByRole('button', { name: '恢复签到', exact: true }).click();
    await lifecycle(page, '恢复记录', '误操作恢复');
    assert.equal(row('SELECT status FROM checkins WHERE id=?', record.id).status, 'confirmed');
    assert.equal(row("SELECT count(*) AS n FROM operation_logs WHERE actor_role='staff'").n, 7);
    assert.ok(page.url().endsWith('/admin/review'));
    await page.locator('.ant-message-notice').last().waitFor({ state: 'hidden' });
    await page.setViewportSize({ width: 1280, height: 600 });
    await noOverflow(page);
    await capture(page, 'CORRECT-01-short');
    await page.setViewportSize({ width: 390, height: 844 });
    await noOverflow(page);
    await capture(page, 'CORRECT-01-mobile');
  },
);

scenario(
  'CORRECT-02',
  'staff同名纠正关联先核对编号，冲突保留原因，重新核对后同步移动礼金',
  async ({ create }) => {
    const admin = await create('admin');
    const source = await guest(admin, '同名改绑宾客');
    const target = await guest(admin, source.name, { groupName: '正确档案' });
    const occupied = await guest(admin, source.name, { groupName: '已到场的另一位' });
    const record = await manual(admin, source.name, { guestId: source.id, amount: 60000 });
    await manual(admin, source.name, { guestId: occupied.id, amount: 0 });
    const linkedId = row('SELECT id FROM gifts WHERE checkin_id=?', record.id).id;
    const independent = await gift(admin, { guestName: source.name, guestId: source.id });
    const staff = await create('staff');
    const page = await staff.newPage();
    await openDetails(page, record);
    await page.getByRole('button', { name: '处理错误登记', exact: true }).click();
    await page.getByRole('menuitem', { name: '纠正关联宾客', exact: true }).click();
    const modal = page.getByRole('dialog', { name: /纠正关联宾客/ });
    await page.setViewportSize({ width: 390, height: 600 });
    const select = modal.getByRole('combobox', { name: /正确的宾客档案$/ });
    await select.fill(source.name);
    await page
      .locator('.ant-select-item-option')
      .filter({ hasText: `#${occupied.id} ·` })
      .click();
    await modal.getByText(/目标宾客已有待审或有效签到/).waitFor();
    assert.equal(
      await modal.getByRole('button', { name: '确认纠正关联', exact: true }).isDisabled(),
      true,
    );
    await select.fill(source.name);
    await page
      .locator('.ant-select-item-option')
      .filter({ hasText: `#${target.id} ·` })
      .click();
    await modal.getByText('请核对本次影响', { exact: true }).waitFor();
    await modal.getByRole('checkbox', { name: '同名宾客选错档案', exact: true }).click();
    await capture(page, 'CORRECT-02-preview');
    await noOverflow(page);
    await api(admin, `/api/gifts/${linkedId}`, 'PATCH', {
      amount: 70000,
      expectedVersion: 1,
      reason: '其他人重新清点',
    });
    await modal.getByRole('button', { name: /确认纠正关联$/ }).click();
    await modal.getByText('关联尚未更改，输入已保留', { exact: true }).waitFor();
    assert.equal(await modal.getByLabel(/纠正原因$/).inputValue(), '同名宾客选错档案');
    assert.equal(row('SELECT guest_id AS id FROM checkins WHERE id=?', record.id).id, source.id);
    await modal.getByRole('button', { name: '重新核对', exact: true }).click();
    await modal.getByText(new RegExp(`礼金 #${linkedId}.*700`)).waitFor();
    await modal.getByRole('button', { name: /确认纠正关联$/ }).click();
    await modal.waitFor({ state: 'hidden' });
    assert.equal(row('SELECT guest_id AS id FROM checkins WHERE id=?', record.id).id, target.id);
    assert.equal(row('SELECT guest_id AS id FROM gifts WHERE id=?', linkedId).id, target.id);
    assert.equal(row('SELECT guest_id AS id FROM gifts WHERE id=?', independent.id).id, source.id);
    assert.equal(row('SELECT count(*) AS n FROM checkins').n, 2);
    assert.ok(page.url().endsWith('/admin/review'));
  },
);

scenario(
  'CORRECT-03',
  'staff补记历史未知人数时保留空值，现场明确填写后才保存',
  async ({ create }) => {
    const admin = await create('admin');
    const record = await manual(admin, '未知人数补记', { amount: 0 });
    row(
      'UPDATE checkins SET actual_headcount=NULL,actual_children_count=NULL WHERE id=? RETURNING id',
      record.id,
    );
    const staff = await create('staff');
    const page = await staff.newPage();
    await openDetails(page, record);
    await page.getByRole('button', { name: '补记人数', exact: true }).click();
    assert.equal(await page.locator('#actualHeadcountInput').inputValue(), '');
    assert.equal(await page.locator('#actualChildrenInput').inputValue(), '');
    await page.getByRole('button', { name: '保存人数', exact: true }).click();
    await page.locator('.ant-form-item-explain-error').first().waitFor();
    assert.equal(row('SELECT actual_headcount AS n FROM checkins WHERE id=?', record.id).n, null);
    await page.locator('#actualHeadcountInput').fill('3');
    await page.locator('#actualChildrenInput').fill('1');
    await page.getByRole('checkbox', { name: '补记实际到场人数', exact: true }).click();
    await page.getByRole('button', { name: '保存人数', exact: true }).click();
    await page.locator('.checkin-drawer.ant-drawer-open').waitFor({ state: 'hidden' });
    assert.equal(row('SELECT actual_headcount AS n FROM checkins WHERE id=?', record.id).n, 3);
    assert.equal(row('SELECT actual_children_count AS n FROM checkins WHERE id=?', record.id).n, 1);
  },
);
