import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { scenario, api, guest, manual, row, capture } from './fixture.mjs';

async function reply(ctx, record, total) {
  await api(ctx, `/api/invite/${record.inviteToken}/rsvp`, 'POST', {
    attending: 'yes',
    headcount: total,
    childrenCount: 1,
    message: null,
  });
}
const self = (ctx, name) =>
  api(ctx, '/api/checkin/self', 'POST', { name, submissionKey: randomUUID() });
async function choose(page, value) {
  await page.getByLabel('对应宾客', { exact: true }).click();
  const option = page.locator('.ant-select-item-option').filter({ hasText: value });
  await option.click();
}
async function confirm(page) {
  await page.getByRole('radio', { name: '仅签到，不登记礼金' }).check();
  await page.getByRole('button', { name: /仅确认到场$/ }).click();
  await page.locator('.review-drawer.ant-drawer-open').waitFor({ state: 'hidden' });
}
async function openManual(page, name) {
  await page.goto('/admin/review');
  await page.getByRole('button', { name: /查人 \/ 手动补录/ }).click();
  await page.locator('#guestName').fill(name);
}
async function countIs(page, value) {
  await page.waitForFunction(
    (expected) => globalThis.document.querySelector('#actualHeadcountInput')?.value === expected,
    String(value),
  );
}

scenario(
  'IDENTITY-01',
  '唯一回执宾客默认选中，仍可新增同名且人数重新初始化',
  async ({ create }) => {
    const admin = await create('admin');
    const staff = await create('staff');
    const record = await guest(admin, '唯一回执宾客');
    await reply(admin, record, 5);
    const submitted = await self(await create(), record.name);
    const page = await staff.newPage();
    await page.goto('/admin/review');
    await page
      .locator('.review-ticket')
      .filter({ hasText: `#${submitted.id}` })
      .click();
    await page.getByLabel('对应宾客', { exact: true }).waitFor();
    await countIs(page, 5);
    await choose(page, '都不是，新增另一位同名宾客');
    await countIs(page, 1);
    assert.equal(await page.locator('#actualChildrenInput').inputValue(), '0');
    await capture(page, 'IDENTITY-01-new-choice');
    await confirm(page);
    assert.equal(row('SELECT count(*) AS n FROM guests').n, 2);
    const saved = row('SELECT guest_id AS id FROM checkins WHERE id=?', submitted.id);
    assert.notEqual(saved.id, record.id);
    assert.equal(row('SELECT headcount FROM rsvps WHERE guest_id=?', record.id).headcount, 5);
    assert.equal(
      row('SELECT group_name AS value FROM guests WHERE id=?', saved.id).value,
      '临时到场',
    );
  },
);

scenario(
  'IDENTITY-02',
  '混合同名只剩一位未签到默认选中，多个未签到必须明确选择',
  async ({ create }) => {
    const ctx = await create('admin');
    const first = await guest(ctx, '混合同名');
    const second = await guest(ctx, '混合同名');
    await reply(ctx, second, 3);
    await manual(ctx, first.name, { guestId: first.id });
    const page = await ctx.newPage();
    await openManual(page, second.name);
    await countIs(page, 3);
    await page.getByLabel('对应宾客', { exact: true }).waitFor();
    await confirm(page);
    assert.equal(
      row("SELECT count(*) AS n FROM checkins WHERE guest_id=? AND status='confirmed'", second.id)
        .n,
      1,
    );
    const a = await guest(ctx, '多人未签到');
    const b = await guest(ctx, '多人未签到');
    await reply(ctx, b, 4);
    await page.getByRole('button', { name: /查人 \/ 手动补录/ }).click();
    await page.locator('#guestName').fill(a.name);
    await page.getByLabel('对应宾客', { exact: true }).waitFor();
    await page.getByRole('radio', { name: '仅签到，不登记礼金' }).check();
    try {
      await page.getByRole('button', { name: '仅确认到场', exact: true }).click();
    } catch (error) {
      console.log(await page.locator('.review-save-actions').ariaSnapshot());
      console.log(await page.locator('.review-save-actions').innerHTML());
      throw error;
    }
    await page.getByText('请选择对应宾客，或新增另一位同名宾客', { exact: true }).waitFor();
    await choose(page, `#${b.id} ·`);
    await countIs(page, 4);
    await confirm(page);
    assert.equal(row('SELECT count(*) AS n FROM checkins WHERE guest_id=?', b.id).n, 1);
    assert.equal(row('SELECT count(*) AS n FROM checkins WHERE guest_id=?', a.id).n, 0);
  },
);

scenario('IDENTITY-03', '全部同名已签到隐藏选择，新增独立档案', async ({ create }) => {
  const ctx = await create('admin');
  const first = await guest(ctx, '全部签到');
  const second = await guest(ctx, '全部签到');
  await manual(ctx, first.name, { guestId: first.id });
  await manual(ctx, second.name, { guestId: second.id });
  const page = await ctx.newPage();
  await openManual(page, first.name);
  await page.getByText('本次新增独立档案，归入“临时到场”。', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('对应宾客', { exact: true }).isVisible(), false);
  await confirm(page);
  assert.equal(row('SELECT count(*) AS n FROM guests').n, 3);
  assert.equal(row('SELECT count(*) AS n FROM checkins').n, 3);
});

scenario('IDENTITY-04', '扫码自动建档复用原ID，未回执的原档案仍允许改选', async ({ create }) => {
  const ctx = await create('admin');
  const visitor = await create();
  const submitted = await self(visitor, '自动建档复用');
  const page = await ctx.newPage();
  await page.goto('/admin/review');
  await page
    .locator('.review-ticket')
    .filter({ hasText: `#${submitted.id}` })
    .click();
  await page.getByText(/本次扫码已建立临时档案/).waitFor();
  assert.equal(await page.getByLabel('对应宾客', { exact: true }).isVisible(), false);
  const id = row('SELECT guest_id AS id FROM checkins WHERE id=?', submitted.id).id;
  await confirm(page);
  assert.equal(row('SELECT count(*) AS n FROM guests').n, 1);
  assert.equal(row('SELECT guest_id AS id FROM checkins WHERE id=?', submitted.id).id, id);
  const original = await guest(ctx, '原名单未回执', { groupName: '临时到场' });
  const next = await self(visitor, original.name);
  await page
    .locator('.review-ticket')
    .filter({ hasText: `#${next.id}` })
    .click();
  await page.getByLabel('对应宾客', { exact: true }).waitFor();
  await confirm(page);
  assert.equal(row('SELECT guest_id AS id FROM checkins WHERE id=?', next.id).id, original.id);
});

scenario(
  'IDENTITY-05',
  '同名另一条待审提供原记录入口，不强行合并也不自动新增',
  async ({ create }) => {
    const ctx = await create('admin');
    const record = await guest(ctx, '同名待审核');
    const visitor = await create();
    const first = await self(visitor, record.name);
    const second = await self(visitor, record.name);
    const page = await ctx.newPage();
    await page.goto('/admin/review');
    await page
      .locator('.review-ticket')
      .filter({ hasText: `#${second.id}` })
      .click();
    await page.getByRole('button', { name: `查看待审 #${first.id}`, exact: true }).click();
    await page.getByText(`提交 #${first.id} · 自助扫码`, { exact: true }).waitFor();
    await page.getByRole('button', { name: `查看待审 #${second.id}`, exact: true }).click();
    await page.getByLabel('对应宾客', { exact: true }).waitFor();
    await choose(page, '都不是，新增另一位同名宾客');
    await confirm(page);
    assert.equal(row('SELECT count(*) AS n FROM guests').n, 2);
    assert.equal(row('SELECT status FROM checkins WHERE id=?', first.id).status, 'pending');
    assert.notEqual(row('SELECT guest_id AS id FROM checkins WHERE id=?', second.id).id, record.id);
  },
);

scenario('IDENTITY-06', '实时确认导致选择失效时保留输入，不偷偷切为新增', async ({ create }) => {
  const ctx = await create('admin');
  const record = await guest(ctx, '并发身份变化');
  const page = await ctx.newPage();
  await openManual(page, record.name);
  await page.getByLabel('对应宾客', { exact: true }).waitFor();
  await page.locator('#actualHeadcountInput').fill('4');
  await manual(ctx, record.name, { guestId: record.id });
  await page.getByText('所选宾客的现场状态已变化，请重新核对', { exact: true }).waitFor();
  assert.equal(await page.locator('#actualHeadcountInput').inputValue(), '4');
  assert.equal(await page.getByLabel('对应宾客', { exact: true }).isVisible(), true);
  await page.getByRole('radio', { name: '仅签到，不登记礼金' }).check();
  assert.equal(
    await page.getByRole('button', { name: '仅确认到场', exact: true }).isDisabled(),
    true,
  );
  await choose(page, '都不是，新增另一位同名宾客');
  await countIs(page, 1);
  await confirm(page);
  assert.equal(row('SELECT count(*) AS n FROM guests').n, 2);
});

scenario('IDENTITY-07', '从明确档案进入核对时保持ID，不按同名顺序另选', async ({ create }) => {
  const ctx = await create('admin');
  await guest(ctx, '明确档案身份');
  const target = await guest(ctx, '明确档案身份');
  await reply(ctx, target, 5);
  const page = await ctx.newPage();
  await page.goto('/admin/review');
  await page.getByRole('tab', { name: '未签到', exact: true }).click();
  await page
    .locator('.review-directory-name')
    .filter({ hasText: `#${target.id}` })
    .click();
  await page.getByRole('button', { name: '进入核对', exact: true }).click();
  await page.getByLabel('对应宾客', { exact: true }).waitFor();
  await countIs(page, 5);
  await confirm(page);
  assert.equal(row('SELECT guest_id AS id FROM checkins').id, target.id);
});

scenario(
  'IDENTITY-08',
  '全部已签到但有另一同名待审时仍核对，无档案手工补录直接新建',
  async ({ create }) => {
    const ctx = await create('admin');
    const record = await guest(ctx, '签到后同名待审');
    await manual(ctx, record.name, { guestId: record.id });
    const visitor = await create();
    const first = await self(visitor, record.name);
    const other = await self(visitor, record.name);
    const page = await ctx.newPage();
    await page.goto('/admin/review');
    await page
      .locator('.review-ticket')
      .filter({ hasText: `#${first.id}` })
      .click();
    await page.getByRole('button', { name: `查看待审 #${other.id}`, exact: true }).waitFor();
    await page.getByLabel('对应宾客', { exact: true }).waitFor();
    await choose(page, '都不是，新增另一位同名宾客');
    await confirm(page);
    assert.equal(row('SELECT count(*) AS n FROM guests').n, 2);
    assert.equal(row('SELECT status FROM checkins WHERE id=?', other.id).status, 'pending');
    await page.getByRole('button', { name: /查人 \/ 手动补录/ }).click();
    await page.locator('#guestName').fill('首次到场无档案');
    await page.getByText('本次新增独立档案，归入“临时到场”。', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('对应宾客', { exact: true }).isVisible(), false);
    await confirm(page);
    assert.equal(row('SELECT count(*) AS n FROM guests').n, 3);
  },
);
