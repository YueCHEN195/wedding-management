import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import Database from 'better-sqlite3';

const dir = mkdtempSync(join(tmpdir(), 'wedding-gift-audit-'));
process.env.DB_PATH = join(dir, 'test.db');
const { sqlite } = await import('../server/db/client');
const { runMigrations } = await import('../server/db/migrate');
const { createToken } = await import('../server/auth/jwt');
const { giftRoutes } = await import('../server/routes/gifts');
const { checkinRoutes } = await import('../server/routes/checkins');
const { publicCheckinRoutes } = await import('../server/routes/checkin');
const { lifecycleRoutes } = await import('../server/routes/lifecycle');
const { statsRoutes } = await import('../server/routes/stats');
runMigrations();
const app = new Hono().route('/api/gifts', giftRoutes).route('/api/checkins', checkinRoutes)
  .route('/api/checkin', publicCheckinRoutes).route('/api/lifecycle', lifecycleRoutes).route('/api/stats', statsRoutes);
app.onError((_, c) => c.json({ ok: false, error: { code: 'INTERNAL' } }, 500));
const cookies = {
  admin: `wedding_session=${await createToken({ id: 1, username: 'admin', role: 'admin' })}`,
  staff: `wedding_session=${await createToken({ id: 2, username: 'staff', role: 'staff' })}`,
};
let ip = 0;
async function request(path: string, method = 'GET', body?: object, role: 'admin' | 'staff' = 'admin') {
  const res = await app.request(path, { method, headers: { Cookie: cookies[role], 'Content-Type': 'application/json', 'X-Forwarded-For': `198.51.100.${++ip}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: res.status, body: await res.json() as any };
}
const create = async () => (await request('/api/gifts', 'POST', { guestName: '礼金留痕验收', amount: 60000, method: 'cash', note: '原备注' })).body.data;
const get = (id: number) => sqlite.prepare('SELECT * FROM gifts WHERE id=?').get(id) as any;
const logs = () => sqlite.prepare("SELECT * FROM operation_logs WHERE entity='gift' ORDER BY id").all() as any[];
const edit = (id: number, overrides: object = {}) => request(`/api/gifts/${id}`, 'PATCH', { amount: 70000, expectedVersion: 1, reason: '重新清点红包', ...overrides });
async function action(id: number, action: string) {
  const p = await request(`/api/lifecycle/gift/${id}/preview?action=${action}`);
  return request(`/api/lifecycle/gift/${id}`, 'POST', { action, token: p.body.data.token, reason: '核对后操作' });
}
beforeEach(() => sqlite.exec('DELETE FROM operation_logs; DELETE FROM gifts; DELETE FROM checkins; DELETE FROM rsvps; DELETE FROM guests;'));
after(() => { sqlite.close(); rmSync(dir, { recursive: true, force: true }); });

test('独立登记及编辑记录真实操作者、原因、金额方式备注前后值，原宾客签到与时间不变', async () => {
  const gift = await create(); assert.equal(gift.version, 1); assert.equal(logs().length, 1);
  assert.equal(logs()[0].action, 'create'); assert.equal(logs()[0].actor_name, 'admin'); assert.equal(JSON.parse(logs()[0].before_json), null);
  const changed = await edit(gift.id, { amount: 12345, method: 'wechat', note: '复核备注' });
  assert.equal(changed.status, 200); assert.equal(changed.body.data.version, 2);
  const current = get(gift.id);
  assert.equal(current.amount, 12345); assert.equal(current.method, 'wechat'); assert.equal(current.note, '复核备注');
  assert.equal(current.recorded_at, gift.recordedAt); assert.equal(current.guest_id, gift.guestId); assert.equal(current.checkin_id, gift.checkinId);
  const log = logs()[1]; assert.equal(log.reason, '重新清点红包'); assert.equal(log.actor_id, 1);
  assert.equal(JSON.parse(log.before_json).amount, 60000); assert.equal(JSON.parse(log.after_json).amount, 12345);
  const history = (await request(`/api/lifecycle/gift/${gift.id}/history`)).body.data;
  assert.match(history[0].detail, /600.00.*现金.*原备注.*123.45.*微信.*复核备注/);
  assert.equal((await request('/api/stats/summary')).body.data.giftTotal, 12345);
});

test('只改金额不清空原备注，不修改时不重复记录日志', async () => {
  const gift = await create(); assert.equal((await edit(gift.id)).status, 200);
  assert.equal(get(gift.id).note, '原备注'); assert.equal(get(gift.id).method, 'cash');
  assert.equal((await edit(gift.id, { expectedVersion: 2 })).status, 409);
  assert.equal(get(gift.id).version, 2); assert.equal(logs().length, 2);
});

test('缺失、非法版本或原因及保护字段都被拒绝，staff不可修改或读取最新礼金', async () => {
  const gift = await create();
  for (const patch of [{ expectedVersion: undefined }, { expectedVersion: 0 }, { expectedVersion: 1.5 }, { expectedVersion: '1' }, { reason: undefined }, { reason: '' }, { reason: ' ' }, { reason: 'x'.repeat(201) }, { guestId: 999 }, { guestName: '换人' }, { actorId: 2 }, { version: 99 }]) {
    assert.equal((await edit(gift.id, patch)).status, 400, JSON.stringify(patch));
  }
  assert.equal(get(gift.id).amount, 60000); assert.equal(get(gift.id).version, 1); assert.equal(logs().length, 1);
  assert.equal((await request(`/api/gifts/${gift.id}`, 'PATCH', { amount: 1, expectedVersion: 1, reason: '越权' }, 'staff')).status, 403);
  assert.equal((await request(`/api/gifts/${gift.id}`, 'GET', undefined, 'staff')).status, 403);
  assert.equal((await app.request(`/api/gifts/${gift.id}`)).status, 401);
  assert.equal((await request(`/api/gifts/${gift.id}`)).body.data.version, 1);
});

test('两人基于同一版本保存，仅一人成功，旧草稿不能覆盖；核对新版本后才可修改', async () => {
  const gift = await create();
  const responses = await Promise.all([edit(gift.id), edit(gift.id, { amount: 80000 })]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]); assert.equal(logs().length, 2);
  const latest = (await request(`/api/gifts/${gift.id}`)).body.data;
  assert.equal(latest.version, 2);
  assert.equal((await edit(gift.id, { amount: 90000 })).body.error.code, 'VERSION_CONFLICT');
  assert.equal((await edit(gift.id, { amount: 90000, expectedVersion: latest.version })).status, 200);
  assert.equal(get(gift.id).version, 3); assert.equal(get(gift.id).amount, 90000);
});

test('金额改回原值后版本仍递增，作废及恢复也使旧编辑失效', async () => {
  const gift = await create(); await edit(gift.id);
  await edit(gift.id, { amount: 60000, expectedVersion: 2 });
  assert.equal(get(gift.id).version, 3);
  assert.equal((await edit(gift.id)).status, 409);
  assert.equal((await action(gift.id, 'void')).status, 200); assert.equal(get(gift.id).version, 4);
  assert.equal((await edit(gift.id, { expectedVersion: 4 })).status, 409);
  assert.equal((await action(gift.id, 'restore')).status, 200); assert.equal(get(gift.id).version, 5);
  assert.equal((await edit(gift.id, { expectedVersion: 3 })).status, 409);
});

test('延迟请求体不能绕过版本核对，礼金编辑也使旧的作废预览失效', async () => {
  const gift = await create();
  const preview = (await request(`/api/lifecycle/gift/${gift.id}/preview?action=void`)).body.data;
  let release!: () => void;
  const stream = new ReadableStream({ start(controller) { release = () => { controller.enqueue(new TextEncoder().encode(JSON.stringify({ amount: 90000, expectedVersion: 1, reason: '延迟编辑' }))); controller.close(); }; } });
  const slow = app.request(new Request(`http://localhost/api/gifts/${gift.id}`, { method: 'PATCH', headers: { Cookie: cookies.admin, 'Content-Type': 'application/json' }, body: stream, duplex: 'half' } as RequestInit));
  assert.equal((await edit(gift.id)).status, 200); release(); assert.equal((await slow).status, 409);
  assert.equal(get(gift.id).amount, 70000);
  assert.equal((await request(`/api/lifecycle/gift/${gift.id}`, 'POST', { action: 'void', reason: '旧预览', token: preview.token })).status, 409);
  assert.equal(get(gift.id).voided_at, null);
});

test('编辑日志写入失败回滚金额和版本，新增礼金日志失败也不留半笔账', async () => {
  const gift = await create();
  sqlite.exec("CREATE TRIGGER fail_gift_log BEFORE INSERT ON operation_logs BEGIN SELECT RAISE(ABORT,'failure'); END;");
  try {
    assert.equal((await edit(gift.id)).status, 500);
    assert.equal(get(gift.id).amount, 60000); assert.equal(get(gift.id).version, 1); assert.equal(logs().length, 1);
    assert.equal((await request('/api/gifts', 'POST', { guestName: '不应登记', amount: 100, method: 'cash' })).status, 500);
    assert.equal((sqlite.prepare('SELECT count(*) n FROM gifts').get() as any).n, 1);
  } finally { sqlite.exec('DROP TRIGGER fail_gift_log'); }
});

test('签到登记礼金留有staff身份，重复补录不重复写日志，无礼金不生成礼金日志', async () => {
  const payload = { guestName: '现场留痕', submissionKey: randomUUID(), actualHeadcount: 2, actualChildrenCount: 0, amount: 12345, method: 'cash' };
  assert.equal((await request('/api/checkins', 'POST', payload, 'staff')).status, 200);
  assert.equal((await request('/api/checkins', 'POST', payload, 'staff')).body.data.duplicate, true);
  assert.equal(logs().length, 1); assert.equal(logs()[0].actor_name, 'staff'); assert.equal(logs()[0].actor_role, 'staff');
  const submitted = await request('/api/checkin/self', 'POST', { name: '扫码留痕', submissionKey: randomUUID() });
  assert.equal((await request(`/api/checkins/${submitted.body.data.id}/confirm`, 'PATCH', { actualHeadcount: 1, actualChildrenCount: 0, amount: 100, method: 'wechat' }, 'staff')).status, 200);
  assert.equal(logs().length, 2); assert.match(logs()[1].reason, /现场审核/);
  assert.equal((await request('/api/checkins', 'POST', { ...payload, guestName: '仅签到留痕', amount: 0, submissionKey: randomUUID() }, 'staff')).status, 200);
  assert.equal(logs().length, 2);
});

test('签到时礼金日志失败回滚签到及建档，重试不重复登记', async () => {
  const payload = { guestName: '日志事务验收', submissionKey: randomUUID(), actualHeadcount: 2, actualChildrenCount: 0, amount: 12345 };
  sqlite.exec("CREATE TRIGGER fail_checkin_gift_log BEFORE INSERT ON operation_logs BEGIN SELECT RAISE(ABORT,'failure'); END;");
  try {
    assert.equal((await request('/api/checkins', 'POST', payload, 'staff')).status, 500);
    assert.equal((sqlite.prepare('SELECT count(*) n FROM checkins').get() as any).n, 0);
    assert.equal((sqlite.prepare('SELECT count(*) n FROM guests').get() as any).n, 0);
    assert.equal(logs().length, 0);
  } finally { sqlite.exec('DROP TRIGGER fail_checkin_gift_log'); }
  assert.equal((await request('/api/checkins', 'POST', payload, 'staff')).status, 200); assert.equal(logs().length, 1);
});

test('旧礼金增量迁移保留金额及关联，版本起始为1，不伪造历史操作者', () => {
  const legacy = new Database(join(dir, 'legacy.db'));
  try {
    for (const tag of ['0000_deep_bucky', '0001_universal_rsvp_credentials', '0002_checkin_submission_retry', '0003_safe_record_lifecycle', '0004_actual_attendance']) legacy.exec(readFileSync(new URL(`../server/db/migrations/${tag}.sql`, import.meta.url), 'utf8'));
    legacy.exec("INSERT INTO gifts (guest_id,guest_name,amount,method,checkin_id,recorded_at) VALUES (10,'旧礼金',60000,'cash',20,1);");
    legacy.exec(readFileSync(new URL('../server/db/migrations/0005_gift_edit_version.sql', import.meta.url), 'utf8'));
    const row = legacy.prepare('SELECT * FROM gifts').get() as any;
    assert.equal(row.version, 1); assert.equal(row.amount, 60000); assert.equal(row.guest_id, 10); assert.equal(row.checkin_id, 20); assert.equal(row.recorded_at, 1);
    assert.equal((legacy.prepare('SELECT count(*) n FROM operation_logs').get() as any).n, 0);
  } finally { legacy.close(); }
});
