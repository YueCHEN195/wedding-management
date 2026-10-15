import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';

const testDir = mkdtempSync(join(tmpdir(), 'wedding-checkin-retry-'));
process.env.DB_PATH = join(testDir, 'test.db');
const { sqlite } = await import('../server/db/client');
const { runMigrations } = await import('../server/db/migrate');
const { createToken } = await import('../server/auth/jwt');
const { publicCheckinRoutes } = await import('../server/routes/checkin');
const { checkinRoutes } = await import('../server/routes/checkins');
runMigrations();
const app = new Hono().route('/api/checkin', publicCheckinRoutes).route('/api/checkins', checkinRoutes);
app.onError((_, c) => c.json({ ok: false, error: { code: 'INTERNAL', message: '模拟写入故障' } }, 500));
const cookie = `wedding_session=${await createToken({ id: 1, username: 'staff', role: 'staff' })}`;
let ip = 0;
async function request(path: string, body: object, method = 'POST') {
  const response = await app.request(path, { method, headers: {
    'Content-Type': 'application/json', Cookie: cookie, 'X-Forwarded-For': `127.0.0.${++ip}`,
  }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() as any };
}
const self = (name: string, submissionKey = randomUUID()) => request('/api/checkin/self', { name, submissionKey });
const manual = (guestName: string, overrides: object = {}) => request('/api/checkins', {
  guestName, amount: 60000, method: 'cash', submissionKey: randomUUID(), ...overrides,
});
const confirm = (id: number, guestId?: number) => request(`/api/checkins/${id}/confirm`, { amount: 60000, method: 'cash', guestId }, 'PATCH');
function addGuest(name: string) {
  return Number(sqlite.prepare(`INSERT INTO guests (name,invite_token,created_at,updated_at)
    VALUES (?,lower(hex(randomblob(16))),1,1)`).run(name).lastInsertRowid);
}
const count = (table: 'checkins' | 'gifts' | 'guests' | 'checkin_submissions') =>
  (sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get() as any).n;
beforeEach(() => { sqlite.exec('DELETE FROM gifts; DELETE FROM checkins; DELETE FROM guests;'); });
after(() => { sqlite.close(); rmSync(testDir, { recursive: true, force: true }); });

test('同一标识重试返回已确认记录，新标识同名提交进入独立待审', async () => {
  addGuest('重复验收');
  const key = randomUUID();
  const first = await self('重复验收', key);
  assert.equal((await confirm(first.body.data.id)).status, 200);
  const retry = await self('重复验收', key);
  assert.equal(retry.body.data.id, first.body.data.id);
  assert.equal(retry.body.data.status, 'confirmed');
  assert.equal(retry.body.data.duplicate, true);
  const another = await self('重复验收');
  assert.notEqual(another.body.data.id, first.body.data.id);
  assert.equal(another.body.data.status, 'pending');
  assert.equal(another.body.data.duplicate, false);
  assert.equal((await confirm(another.body.data.id)).status, 409);
  assert.equal(count('checkins'), 2);
  assert.equal(count('gifts'), 1);
});

test('待审核期间同次重试复用记录，另一标识同名提交独立待审', async () => {
  addGuest('待审重试');
  const key = randomUUID();
  const first = await self('待审重试', key);
  const retry = await self('待审重试', key);
  const another = await self('待审重试');
  assert.equal(retry.body.data.id, first.body.data.id);
  assert.notEqual(another.body.data.id, first.body.data.id);
  assert.equal(count('checkins'), 2);
});

test('同名提交的网络重试复用同一记录，两位同名使用不同标识能分别登记', async () => {
  const a = addGuest('同名重试'); const b = addGuest('同名重试');
  const key = randomUUID();
  const first = await self('同名重试', key);
  assert.equal((await self('同名重试', key)).body.data.id, first.body.data.id);
  const second = await self('同名重试');
  assert.notEqual(second.body.data.id, first.body.data.id);
  assert.equal((await confirm(first.body.data.id, a)).status, 200);
  assert.equal((await confirm(second.body.data.id, a)).status, 409);
  assert.equal(count('gifts'), 1);
  assert.equal((await confirm(second.body.data.id, b)).status, 200);
  assert.equal(count('checkins'), 2);
  assert.equal(count('gifts'), 2);
  assert.equal((await self('同名重试', key)).body.data.status, 'confirmed');
});

test('手动补录的同次重试只记一笔，另一次重复补录被拒绝', async () => {
  addGuest('补录重试');
  const key = randomUUID();
  const first = await manual('补录重试', { submissionKey: key });
  const retry = await manual('补录重试', { submissionKey: key });
  assert.equal(first.status, 200);
  assert.equal(retry.status, 200);
  assert.equal(retry.body.data.id, first.body.data.id);
  assert.equal(retry.body.data.duplicate, true);
  const duplicate = await manual('补录重试');
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error.code, 'ALREADY_CHECKED_IN');
  assert.equal(count('checkins'), 1);
  assert.equal(count('gifts'), 1);
});

test('已有自助待审时，手动补录提示处理原记录而不创建第二条', async () => {
  addGuest('先自助');
  await self('先自助');
  const result = await manual('先自助');
  assert.equal(result.status, 409);
  assert.equal(result.body.error.code, 'ALREADY_SUBMITTED');
  assert.equal(count('checkins'), 1);
  assert.equal(count('gifts'), 0);
});

test('手动确认后新设备同名扫码仍可进入待审核', async () => {
  addGuest('先补录');
  const first = await manual('先补录');
  const result = await self('先补录');
  assert.notEqual(result.body.data.id, first.body.data.id);
  assert.equal(result.body.data.status, 'pending');
  assert.equal(count('checkins'), 2);
});

test('同一提交标识改变姓名、金额或改用另一入口，不能静默复用或再次写入', async () => {
  const key = randomUUID();
  await manual('固定提交', { submissionKey: key });
  for (const body of [{ amount: 70000 }, { guestName: '另一姓名' }]) {
    const result = await manual('固定提交', { submissionKey: key, ...body });
    assert.equal(result.status, 409);
    assert.equal(result.body.error.code, 'IDEMPOTENCY_CONFLICT');
  }
  assert.equal((await self('固定提交', key)).status, 409);
  assert.equal(count('checkins'), 1);
  assert.equal(count('gifts'), 1);
});

test('两个同时到达的自助请求只建立一份已关联宾客待审记录', async () => {
  addGuest('并发自助');
  const key = randomUUID();
  const [a, b] = await Promise.all([self('并发自助', key), self('并发自助', key)]);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.equal(a.body.data.id, b.body.data.id);
  assert.equal(count('checkins'), 1);
});

test('延迟请求体到达时重新读取状态，不能把一条签到确认两次', async () => {
  addGuest('延迟确认');
  const first = await self('延迟确认');
  let releaseBody!: () => void;
  const stream = new ReadableStream({ start(controller) {
    releaseBody = () => { controller.enqueue(new TextEncoder().encode(JSON.stringify({ amount: 60000, method: 'cash' }))); controller.close(); };
  } });
  const slow = app.request(new Request(`http://localhost/api/checkins/${first.body.data.id}/confirm`, {
    method: 'PATCH', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: stream, duplex: 'half',
  } as RequestInit));
  const fast = await confirm(first.body.data.id);
  releaseBody();
  assert.equal(fast.status, 200);
  assert.equal((await slow).status, 409);
  assert.equal(count('gifts'), 1);
});

test('礼金写入失败时确认回滚，仍能用原提交再次审核', async () => {
  addGuest('审核回滚');
  const first = await self('审核回滚');
  sqlite.exec("CREATE TRIGGER fail_gift BEFORE INSERT ON gifts BEGIN SELECT RAISE(ABORT,'simulated failure'); END;");
  try {
    assert.equal((await confirm(first.body.data.id)).status, 500);
    assert.equal((sqlite.prepare('SELECT status FROM checkins WHERE id=?').get(first.body.data.id) as any).status, 'pending');
    assert.equal(count('gifts'), 0);
  } finally { sqlite.exec('DROP TRIGGER fail_gift'); }
  assert.equal((await confirm(first.body.data.id)).status, 200);
  assert.equal(count('gifts'), 1);
});

test('手动补录失败时宾客、签到、提交映射一起回滚，同标识重试可成功', async () => {
  const key = randomUUID();
  sqlite.exec("CREATE TRIGGER fail_gift BEFORE INSERT ON gifts BEGIN SELECT RAISE(ABORT,'simulated failure'); END;");
  try {
    assert.equal((await manual('补录回滚', { submissionKey: key })).status, 500);
    assert.equal(count('guests'), 0);
    assert.equal(count('checkins'), 0);
    assert.equal(count('checkin_submissions'), 0);
  } finally { sqlite.exec('DROP TRIGGER fail_gift'); }
  assert.equal((await manual('补录回滚', { submissionKey: key })).status, 200);
  assert.equal(count('gifts'), 1);
});

test('缺失或非法提交标识不能绕过重试保护', async () => {
  assert.equal((await request('/api/checkin/self', { name: '缺少标识' })).status, 400);
  assert.equal((await self('错误标识', 'bad-key')).status, 400);
  assert.equal((await manual('错误补录', { submissionKey: 'bad-key' })).status, 400);
  assert.equal(count('checkins'), 0);
});

test('历史重复记录不删除，新同名提交待核对且不能再确认给已签到者', async () => {
  const id = addGuest('历史重复');
  const insert = sqlite.prepare(`INSERT INTO checkins (guest_id,guest_name,status,submitted_at) VALUES (?,'历史重复',?,1)`);
  insert.run(id, 'pending');
  const confirmedId = Number(insert.run(id, 'confirmed').lastInsertRowid);
  const result = await self('历史重复');
  assert.notEqual(result.body.data.id, confirmedId);
  assert.equal(result.body.data.status, 'pending');
  assert.equal((await confirm(result.body.data.id, id)).status, 409);
  assert.equal(count('checkins'), 3);
});

const newGuest = { groupName: '新郎同事带来的朋友', side: 'male' };
test('第二位未预登记的同名临时宾客可在审核时新建，礼金分属两个ID', async () => {
  const first = await self('临时同名');
  assert.equal((await confirm(first.body.data.id)).status, 200);
  const second = await self('临时同名');
  const keyBody = { amount: 80000, method: 'cash', newGuest };
  const saved = await request(`/api/checkins/${second.body.data.id}/confirm`, keyBody, 'PATCH');
  assert.equal(saved.status, 200);
  const rows = sqlite.prepare('SELECT guest_id, amount FROM gifts ORDER BY id').all() as any[];
  assert.equal(rows.length, 2);
  assert.notEqual(rows[0].guest_id, rows[1].guest_id);
  assert.equal(rows[1].amount, 80000);
  const guest = sqlite.prepare('SELECT group_name, side FROM guests WHERE id=?').get(rows[1].guest_id) as any;
  assert.equal(guest.group_name, newGuest.groupName);
  assert.equal(guest.side, 'male');
  assert.equal((await request(`/api/checkins/${second.body.data.id}/confirm`, keyBody, 'PATCH')).status, 409);
  assert.equal(count('guests'), 2);
});

test('手动补录可新建同名档案，同标识重试不再新建，改变辨识信息冲突', async () => {
  await manual('手动同名');
  const submissionKey = randomUUID();
  const saved = await manual('手动同名', { submissionKey, newGuest });
  assert.equal(saved.status, 200);
  const retry = await manual('手动同名', { submissionKey, newGuest });
  assert.equal(retry.body.data.id, saved.body.data.id);
  assert.equal(retry.body.data.duplicate, true);
  assert.equal(count('guests'), 2);
  assert.equal(count('gifts'), 2);
  const conflict = await manual('手动同名', { submissionKey, newGuest: { groupName: '另一分组' } });
  assert.equal(conflict.status, 409);
});

test('新建同名档案须有辨识分组，不能同时选择已有宾客，未登录不能建档', async () => {
  const guestId = addGuest('非法新建');
  for (const value of [{}, { groupName: '  ' }, { groupName: 'a'.repeat(51) }, { groupName: '朋友', side: 'bad' }]) {
    assert.equal((await manual('非法新建', { newGuest: value })).status, 400);
  }
  assert.equal((await manual('非法新建', { guestId, newGuest })).status, 400);
  const unauthenticated = await app.request('/api/checkins', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guestName: '非法新建', newGuest, submissionKey: randomUUID() }) });
  assert.equal(unauthenticated.status, 401);
  assert.equal(count('guests'), 1);
  assert.equal(count('checkins'), 0);
});

test('新建同名档案与礼金处于同一事务，写失败不遗留新档案', async () => {
  await manual('新建回滚');
  const second = await self('新建回滚');
  sqlite.exec("CREATE TRIGGER fail_gift BEFORE INSERT ON gifts BEGIN SELECT RAISE(ABORT,'simulated failure'); END;");
  try {
    assert.equal((await request(`/api/checkins/${second.body.data.id}/confirm`, { amount: 100, newGuest }, 'PATCH')).status, 500);
    assert.equal(count('guests'), 1);
    assert.equal(count('gifts'), 1);
    assert.equal((sqlite.prepare('SELECT status FROM checkins WHERE id=?').get(second.body.data.id) as any).status, 'pending');
  } finally { sqlite.exec('DROP TRIGGER fail_gift'); }
});
