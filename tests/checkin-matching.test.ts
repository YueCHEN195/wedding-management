import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';

// 必须在加载数据库模块前指定临时文件，测试绝不读取本地业务数据库。
const testDir = mkdtempSync(join(tmpdir(), 'wedding-matching-'));
process.env.DB_PATH = join(testDir, 'test.db');
const { sqlite } = await import('../server/db/client');
const { runMigrations } = await import('../server/db/migrate');
const { createToken } = await import('../server/auth/jwt');
const { publicCheckinRoutes } = await import('../server/routes/checkin');
const { checkinRoutes } = await import('../server/routes/checkins');
runMigrations();
const app = new Hono();
app.route('/api/checkin', publicCheckinRoutes);
app.route('/api/checkins', checkinRoutes);
const cookie = `wedding_session=${await createToken({ id: 1, username: 'staff', role: 'staff' })}`;

async function request(path: string, method = 'GET', body?: object, authenticated = true) {
  if (body && (path === '/api/checkins' || path.endsWith('/confirm'))) body = { actualHeadcount: 1, actualChildrenCount: 0, ...body };
  const response = await app.request(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(authenticated ? { Cookie: cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() as any };
}

function addGuest(name = '同名测试', group = '朋友') {
  return Number(sqlite.prepare(`INSERT INTO guests
    (name, group_name, side, phone, note, invite_token, created_at, updated_at)
    VALUES (?, ?, 'male', '13800000000', '私有备注', lower(hex(randomblob(16))), 1, 1)`)
    .run(name, group).lastInsertRowid);
}

async function selfCheckin(name = '同名测试') {
  return request('/api/checkin/self', 'POST', { name, submissionKey: randomUUID() }, false);
}

beforeEach(() => {
  sqlite.exec('DELETE FROM gifts; DELETE FROM checkins; DELETE FROM rsvps; DELETE FROM guests;');
});
after(() => {
  sqlite.close();
  rmSync(testDir, { recursive: true, force: true });
});

test('同名自助提交不自动绑定第一位，也不新增第三位宾客', async () => {
  addGuest(); addGuest('同名测试', '亲戚');
  const result = await selfCheckin();
  assert.equal(result.status, 200);
  const row = sqlite.prepare('SELECT * FROM checkins WHERE id=?').get(result.body.data.id) as any;
  assert.equal(row.guest_id, null);
  assert.equal((sqlite.prepare('SELECT count(*) AS n FROM guests').get() as any).n, 2);
});

test('两位同名宾客各自提交都能进入待审，不按姓名互相去重', async () => {
  addGuest(); addGuest();
  const first = await selfCheckin();
  const second = await selfCheckin();
  assert.notEqual(first.body.data.id, second.body.data.id);
  assert.equal(second.body.data.duplicate, false);
});

test('工作人员可读取候选辨认信息，但不返回私有凭证、电话和备注', async () => {
  const id = addGuest(); addGuest('同名测试', '亲戚');
  sqlite.prepare(`INSERT INTO rsvps (guest_id, guest_name, attending, headcount, submitted_at, updated_at)
    VALUES (?, '同名测试', 'yes', 3, 1, 1)`).run(id);
  const result = await request('/api/checkins/candidates?name='+encodeURIComponent('同名测试'));
  assert.equal(result.status, 200);
  assert.equal(result.body.data.length, 2);
  assert.equal(result.body.data.find((g: any) => g.id === id).headcount, 3);
  for (const candidate of result.body.data) {
    assert.deepEqual(Object.keys(candidate).sort(), ['attending', 'checkedIn', 'childrenCount', 'groupName', 'headcount', 'id', 'name', 'side']);
  }
  assert.equal((await request('/api/checkins/candidates?name=test', 'GET', undefined, false)).status, 401);
});

test('同名候选的签到状态按各自ID区分，待审核提交不算已签到', async () => {
  const confirmedId = addGuest();
  const pendingId = addGuest();
  const notSubmittedId = addGuest();
  const insert = sqlite.prepare(`INSERT INTO checkins (guest_id, guest_name, status, submitted_at)
    VALUES (?, '同名测试', ?, 1)`);
  insert.run(confirmedId, 'confirmed');
  insert.run(pendingId, 'pending');
  const result = await request('/api/checkins/candidates?name='+encodeURIComponent('同名测试'));
  assert.equal(result.status, 200);
  const byId = new Map<number, boolean>(result.body.data.map((g: any) => [g.id, g.checkedIn]));
  assert.equal(byId.get(confirmedId), true);
  assert.equal(byId.get(pendingId), false);
  assert.equal(byId.get(notSubmittedId), false);
});

test('待审列表明确标出同名选择要求及候选', async () => {
  addGuest(); addGuest();
  await selfCheckin();
  const result = await request('/api/checkins/pending');
  assert.equal(result.body.data[0].requiresGuestSelection, true);
  assert.equal(result.body.data[0].guestCandidates.length, 2);
});

test('没有选择同名宾客时，后端拒绝确认，签到与礼金均不变化', async () => {
  addGuest(); addGuest();
  const submitted = await selfCheckin();
  const result = await request(`/api/checkins/${submitted.body.data.id}/confirm`, 'PATCH', { amount: 50000, method: 'cash' });
  assert.equal(result.status, 409);
  assert.equal(result.body.error.code, 'AMBIGUOUS_GUEST');
  assert.equal((sqlite.prepare('SELECT status FROM checkins WHERE id=?').get(submitted.body.data.id) as any).status, 'pending');
  assert.equal((sqlite.prepare('SELECT count(*) AS n FROM gifts').get() as any).n, 0);
});

test('明确选择第二位同名宾客后，签到和礼金均关联第二位', async () => {
  const first = addGuest(); const second = addGuest('同名测试', '亲戚');
  const submitted = await selfCheckin();
  const result = await request(`/api/checkins/${submitted.body.data.id}/confirm`, 'PATCH', { guestId: second, amount: 50000, method: 'cash' });
  assert.equal(result.status, 200);
  assert.equal(result.body.data.guestId, second);
  assert.equal((sqlite.prepare('SELECT guest_id FROM gifts').get() as any).guest_id, second);
  assert.equal((sqlite.prepare('SELECT count(*) AS n FROM checkins WHERE guest_id=?').get(first) as any).n, 0);
});

test('手动补录同名时也必须选择宾客', async () => {
  addGuest(); const second = addGuest();
  const failed = await request('/api/checkins', 'POST', { guestName: '同名测试', amount: 0, submissionKey: randomUUID() });
  assert.equal(failed.status, 409);
  assert.equal((sqlite.prepare('SELECT count(*) AS n FROM checkins').get() as any).n, 0);
  const saved = await request('/api/checkins', 'POST', { guestName: '同名测试', guestId: second, amount: 0, submissionKey: randomUUID() });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.data.guestId, second);
});

test('篡改选择为其他姓名、已删除ID或非法ID，都不能回退到第一位', async () => {
  addGuest(); addGuest();
  const other = addGuest('其他姓名');
  const submitted = await selfCheckin();
  for (const guestId of [other, 999999, -1, 1.5, '1']) {
    const result = await request(`/api/checkins/${submitted.body.data.id}/confirm`, 'PATCH', { guestId, amount: 100, method: 'cash' });
    assert.equal(result.status, 400, `guestId=${guestId}`);
  }
  assert.equal((sqlite.prepare('SELECT count(*) AS n FROM gifts').get() as any).n, 0);
});

test('旧版本已经自动关联的待审记录，在存在同名时也要求重新核对', async () => {
  const first = addGuest();
  const submitted = await selfCheckin();
  assert.equal((sqlite.prepare('SELECT guest_id FROM checkins WHERE id=?').get(submitted.body.data.id) as any).guest_id, first);
  const second = addGuest();
  assert.equal((await request(`/api/checkins/${submitted.body.data.id}/confirm`, 'PATCH', { amount: 0 })).status, 409);
  const saved = await request(`/api/checkins/${submitted.body.data.id}/confirm`, 'PATCH', { guestId: second, amount: 0 });
  assert.equal(saved.body.data.guestId, second);
});

test('唯一匹配仍可直接关联，无匹配仍自动建档', async () => {
  const id = addGuest('唯一测试');
  const known = await selfCheckin('唯一测试');
  assert.equal((sqlite.prepare('SELECT guest_id FROM checkins WHERE id=?').get(known.body.data.id) as any).guest_id, id);
  const unknown = await selfCheckin('临时测试');
  const linked = sqlite.prepare('SELECT guest_id FROM checkins WHERE id=?').get(unknown.body.data.id) as any;
  assert.ok(linked.guest_id);
  assert.equal((sqlite.prepare('SELECT name FROM guests WHERE id=?').get(linked.guest_id) as any).name, '临时测试');
});


test('签到候选按宾客编号提供各自最新回执的总人数与儿童，不混用同名回执', async () => {
  const first = addGuest(); const second = addGuest('同名测试', '亲戚');
  const insert = sqlite.prepare("INSERT INTO rsvps (guest_id,guest_name,attending,headcount,children_count,submitted_at,updated_at) VALUES (?,'同名测试','yes',?,?,1,?)");
  insert.run(first, 2, 0, 1); insert.run(first, 5, 2, 2); insert.run(second, 3, 1, 3);
  const candidates = (await request('/api/checkins/candidates?name='+encodeURIComponent('同名测试'))).body.data;
  assert.deepEqual(candidates.map((g: any) => [g.id, g.headcount, g.childrenCount]), [[first, 5, 2], [second, 3, 1]]);
});
