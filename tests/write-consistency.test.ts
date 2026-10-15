import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';

const testDir = mkdtempSync(join(tmpdir(), 'wedding-consistency-'));
process.env.DB_PATH = join(testDir, 'test.db');
const { sqlite } = await import('../server/db/client');
const { runMigrations } = await import('../server/db/migrate');
const { createToken } = await import('../server/auth/jwt');
const { guestRoutes } = await import('../server/routes/guests');
const { inviteRoutes } = await import('../server/routes/invite');
const { lifecycleRoutes } = await import('../server/routes/lifecycle');
const { rsvpRoutes } = await import('../server/routes/rsvps');
const { buildWorkbook } = await import('../server/services/excel');
runMigrations();
const app = new Hono().route('/api/lifecycle', lifecycleRoutes).route('/api/guests', guestRoutes).route('/api/invite', inviteRoutes).route('/api/rsvps', rsvpRoutes);
app.onError((_, c) => c.json({ ok: false, error: { code: 'INTERNAL', message: '写入失败' } }, 500));
const cookie = `wedding_session=${await createToken({ id: 1, username: 'admin', role: 'admin' })}`;
let ip = 0;
async function request(path: string, method = 'GET', body?: object) {
  const response = await app.request(path, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json',
    'X-Forwarded-For': `127.0.1.${++ip}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() as any };
}
async function archive(id: number) {
  const preview = await request(`/api/lifecycle/guest/${id}/preview?action=archive`);
  assert.equal(preview.status, 200);
  return request(`/api/lifecycle/guest/${id}`, 'POST', { action: 'archive', reason: '验收归档', token: preview.body.data.token });
}
function addGuest(status = 'pending') {
  return Number(sqlite.prepare(`INSERT INTO guests (name,invite_token,status,created_at,updated_at) VALUES ('事务验收','private-token',?,1,1)`).run(status).lastInsertRowid);
}
function addRsvp(id: number | null) {
  return Number(sqlite.prepare(`INSERT INTO rsvps (guest_id,guest_name,attending,headcount,submitted_at,updated_at) VALUES (?,'事务验收','yes',3,1,1)`).run(id).lastInsertRowid);
}
function snapshot() {
  return Object.fromEntries(['guests', 'rsvps', 'checkins', 'gifts'].map((table) => [table, sqlite.prepare(`SELECT * FROM ${table} ORDER BY id`).all()]));
}
function linkedRecords() {
  const id = addGuest('rsvp'); addRsvp(id);
  const checkinId = Number(sqlite.prepare(`INSERT INTO checkins (guest_id,guest_name,status,submitted_at) VALUES (?,'事务验收','confirmed',1)`).run(id).lastInsertRowid);
  sqlite.prepare(`INSERT INTO gifts (guest_id,guest_name,amount,method,checkin_id,recorded_at) VALUES (?,'事务验收',60000,'cash',?,1)`).run(id, checkinId);
  return id;
}
const submit = (headcount = 3) => request('/api/invite/private-token/rsvp', 'POST', { attending: 'yes', headcount, childrenCount: 0 });
function delayedRequest(path: string, method: string, body: object) {
  let release!: () => void;
  const stream = new ReadableStream({ start(controller) { release = () => {
    controller.enqueue(new TextEncoder().encode(JSON.stringify(body))); controller.close();
  }; } });
  const promise = app.request(new Request('http://localhost'+path, { method,
    headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-Forwarded-For': `127.0.1.${++ip}` },
    body: stream, duplex: 'half' } as RequestInit));
  return { promise, release };
}
beforeEach(() => sqlite.exec('DELETE FROM gifts; DELETE FROM checkins; DELETE FROM rsvps; DELETE FROM guests;'));
after(() => { sqlite.close(); rmSync(testDir, { recursive: true, force: true }); });

test('旧删除接口关闭，归档保留全部关联和记录', async () => {
  const id = linkedRecords(); const before = snapshot();
  assert.equal((await request(`/api/guests/${id}`, 'DELETE')).status, 409);
  assert.deepEqual(snapshot(), before);
  assert.equal((await archive(id)).status, 200);
  const remaining = snapshot() as any;
  assert.equal(remaining.guests.length, 1); assert.equal(remaining.rsvps.length, 1);
  assert.equal(remaining.checkins[0].guest_id, id); assert.equal(remaining.gifts[0].guest_id, id);
  assert.equal(remaining.gifts[0].amount, 60000);
  assert.equal(remaining.gifts[0].checkin_id, remaining.checkins[0].id);
});

test('归档审计写入失败时宾客状态与关联完整回滚', async () => {
  const id = linkedRecords(); const before = snapshot();
  sqlite.exec("CREATE TRIGGER fail_write BEFORE INSERT ON operation_logs BEGIN SELECT RAISE(ABORT,'failure'); END;");
  try {
    assert.equal((await archive(id)).status, 500);
    assert.deepEqual(snapshot(), before);
  } finally { sqlite.exec('DROP TRIGGER fail_write'); }
});

test('专属回执首次写入失败，宾客不应提前变成已回执', async () => {
  addGuest('viewed'); const before = snapshot();
  sqlite.exec("CREATE TRIGGER fail_write BEFORE INSERT ON rsvps BEGIN SELECT RAISE(ABORT,'failure'); END;");
  try {
    assert.equal((await submit()).status, 500);
    assert.deepEqual(snapshot(), before);
  } finally { sqlite.exec('DROP TRIGGER fail_write'); }
  const saved = await submit();
  assert.equal(saved.status, 200);
  assert.equal((snapshot() as any).guests[0].status, 'rsvp');
});

test('专属回执更新后同步宾客状态失败，回执人数和留言也回滚', async () => {
  const id = addGuest('viewed'); addRsvp(id); const before = snapshot();
  sqlite.exec("CREATE TRIGGER fail_write BEFORE UPDATE ON guests BEGIN SELECT RAISE(ABORT,'failure'); END;");
  try {
    assert.equal((await submit(5)).status, 500);
    assert.deepEqual(snapshot(), before);
  } finally { sqlite.exec('DROP TRIGGER fail_write'); }
});

test('专属回执慢请求解析期间宾客已归档，应返回404且不生成孤立回执', async () => {
  const id = addGuest();
  const slow = delayedRequest('/api/invite/private-token/rsvp', 'POST', { attending: 'yes', headcount: 3 });
  assert.equal((await archive(id)).status, 200);
  slow.release();
  assert.equal((await slow.promise).status, 404);
  assert.deepEqual((snapshot() as any).rsvps, []);
});

test('管理员修改回执慢请求期间宾客已归档，返回404而不是空数据或500', async () => {
  const id = addGuest(); const rsvpId = addRsvp(id);
  const slow = delayedRequest(`/api/rsvps/${rsvpId}`, 'PATCH', { headcount: 4 });
  assert.equal((await archive(id)).status, 200);
  slow.release();
  assert.equal((await slow.promise).status, 404);
});

test('后台修改已关联回执时同步已回执状态，失败完整回滚', async () => {
  const id = addGuest('sent'); const rsvpId = addRsvp(id); const before = snapshot();
  sqlite.exec("CREATE TRIGGER fail_write BEFORE UPDATE ON guests BEGIN SELECT RAISE(ABORT,'failure'); END;");
  try {
    assert.equal((await request(`/api/rsvps/${rsvpId}`, 'PATCH', { headcount: 4 })).status, 500);
    assert.deepEqual(snapshot(), before);
  } finally { sqlite.exec('DROP TRIGGER fail_write'); }
  assert.equal((await request(`/api/rsvps/${rsvpId}`, 'PATCH', { headcount: 4 })).status, 200);
  assert.equal((snapshot() as any).guests[0].status, 'rsvp');
});

test('标记已发送不降低已查看或已回执状态，重复标记保留首次发送时间', async () => {
  const id = addGuest('viewed');
  const first = await request(`/api/guests/${id}/mark-sent`, 'POST');
  assert.equal(first.body.data.status, 'viewed');
  const invitedAt = first.body.data.invitedAt;
  assert.ok(invitedAt);
  await submit();
  const second = await request(`/api/guests/${id}/mark-sent`, 'POST');
  assert.equal(second.body.data.status, 'rsvp');
  assert.equal(second.body.data.invitedAt, invitedAt);
  sqlite.prepare("UPDATE guests SET status='sent' WHERE id=?").run(id);
  assert.equal((await request(`/api/guests/${id}/mark-sent`, 'POST')).body.data.status, 'rsvp');
});

async function importGuests(rows: Record<string, unknown>[]) {
  const buffer = await buildWorkbook([{ name: '宾客', columns: [{ header: '姓名', key: 'name' }, { header: '分组', key: 'groupName' }], rows }]);
  const form = new FormData(); form.set('file', new File([new Uint8Array(buffer)], 'guests.xlsx'));
  return app.request('/api/guests/import', { method: 'POST', headers: { Cookie: cookie }, body: form });
}
test('批量导入第二行写入失败时第一行也回滚，重试不会重复导入半批数据', async () => {
  sqlite.exec("CREATE TRIGGER fail_write BEFORE INSERT ON guests WHEN NEW.name='导入第二位' BEGIN SELECT RAISE(ABORT,'failure'); END;");
  try {
    assert.equal((await importGuests([{ name: '导入第一位' }, { name: '导入第二位' }])).status, 500);
    assert.deepEqual((snapshot() as any).guests, []);
  } finally { sqlite.exec('DROP TRIGGER fail_write'); }
  assert.equal((await importGuests([{ name: '导入第一位' }, { name: '导入第二位' }])).status, 200);
  assert.equal((snapshot() as any).guests.length, 2);
});

test('导入仍跳过格式错误行并报告行号，通用回执的后台修改不关联同名名单', async () => {
  const imported = await importGuests([{ name: '有效导入' }, { groupName: '缺姓名' }]);
  assert.equal(imported.status, 200);
  const data = (await imported.json() as any).data;
  assert.equal(data.created, 1); assert.equal(data.failed[0].row, 3);
  addGuest(); const id = addRsvp(null);
  assert.equal((await request(`/api/rsvps/${id}`, 'PATCH', { headcount: 4 })).status, 200);
  const state = snapshot() as any;
  assert.ok(state.guests.every((g: any) => g.status === 'pending'));
  assert.equal(state.rsvps[0].guest_id, null);
});
