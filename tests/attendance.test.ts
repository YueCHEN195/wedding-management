import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import ExcelJS from 'exceljs';
import Database from 'better-sqlite3';

const dir = mkdtempSync(join(tmpdir(), 'wedding-attendance-'));
process.env.DB_PATH = join(dir, 'test.db');
const { sqlite } = await import('../server/db/client');
const { runMigrations } = await import('../server/db/migrate');
const { createToken } = await import('../server/auth/jwt');
const { checkinRoutes } = await import('../server/routes/checkins');
const { publicCheckinRoutes } = await import('../server/routes/checkin');
const { lifecycleRoutes } = await import('../server/routes/lifecycle');
const { statsRoutes } = await import('../server/routes/stats');
const { exportRoutes } = await import('../server/routes/export');
runMigrations();
const app = new Hono().route('/api/checkins', checkinRoutes).route('/api/checkin', publicCheckinRoutes)
  .route('/api/lifecycle', lifecycleRoutes).route('/api/stats', statsRoutes).route('/api/export', exportRoutes);
app.onError((_, c) => c.json({ ok: false, error: { code: 'INTERNAL' } }, 500));
const cookies = {
  admin: `wedding_session=${await createToken({ id: 1, username: 'admin', role: 'admin' })}`,
  staff: `wedding_session=${await createToken({ id: 2, username: 'staff', role: 'staff' })}`,
};
let ip = 0;
async function request(path: string, method = 'GET', body?: object, role: 'admin' | 'staff' = 'admin') {
  const res = await app.request(path, { method, headers: { Cookie: cookies[role], 'Content-Type': 'application/json', 'X-Forwarded-For': `192.0.2.${++ip}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: res.status, body: await res.json() as any };
}
const counts = { actualHeadcount: 3, actualChildrenCount: 1 };
async function manual(name = '到场人数验收', patch: object = {}) {
  return request('/api/checkins', 'POST', { guestName: name, submissionKey: randomUUID(), ...counts, amount: 0, ...patch });
}
const stats = async () => (await request('/api/stats/summary')).body.data;
const row = (id: number) => sqlite.prepare('SELECT * FROM checkins WHERE id=?').get(id) as any;
async function action(entity: string, id: number, action: string) {
  const p = await request(`/api/lifecycle/${entity}/${id}/preview?action=${action}`);
  assert.equal(p.status, 200);
  return request(`/api/lifecycle/${entity}/${id}`, 'POST', { action, token: p.body.data.token, reason: '验收到场统计变化' });
}
beforeEach(() => sqlite.exec('DELETE FROM operation_logs; DELETE FROM gifts; DELETE FROM checkins; DELETE FROM rsvps; DELETE FROM guests;'));
after(() => { sqlite.close(); rmSync(dir, { recursive: true, force: true }); });

test('一家三人含一名儿童：到场3人1组，不用回执5人推算且不覆盖回执', async () => {
  const guest = Number(sqlite.prepare("INSERT INTO guests (name,invite_token,created_at,updated_at) VALUES ('到场人数验收','attendance-token',1,1)").run().lastInsertRowid);
  sqlite.prepare("INSERT INTO rsvps (guest_id,guest_name,attending,headcount,children_count,submitted_at,updated_at) VALUES (?,'到场人数验收','yes',5,2,1,1)").run(guest);
  const sub = await request('/api/checkin/self', 'POST', { name: '到场人数验收', submissionKey: randomUUID() });
  assert.equal(row(sub.body.data.id).actual_headcount, null);
  const result = await request(`/api/checkins/${sub.body.data.id}/confirm`, 'PATCH', { ...counts, amount: 60000, method: 'cash' }, 'staff');
  assert.equal(result.status, 200);
  assert.equal(result.body.data.actualHeadcount, 3);
  const s = await stats();
  assert.equal(s.checkinCount, 1); assert.equal(s.actualHeadcount, 3); assert.equal(s.actualChildrenCount, 1);
  assert.equal(s.attendingHeadcount, 5); assert.equal(s.unknownHeadcountGroups, 0); assert.equal(s.giftTotal, 60000);
  assert.equal((sqlite.prepare('SELECT headcount FROM rsvps').get() as any).headcount, 5);
  assert.equal((await request(`/api/checkins/${sub.body.data.id}/confirm`, 'PATCH', { ...counts, amount: 60000 })).status, 409);
  assert.equal((await stats()).actualHeadcount, 3);
});

test('无礼金补录仍记录实际人数，同次重试不增人数，改人数重试报冲突', async () => {
  const key = randomUUID();
  const first = await manual('无礼金三人', { submissionKey: key });
  assert.equal(first.status, 200);
  const retry = await manual('无礼金三人', { submissionKey: key });
  assert.equal(retry.body.data.id, first.body.data.id); assert.equal(retry.body.data.duplicate, true);
  assert.equal((await manual('无礼金三人', { submissionKey: key, actualHeadcount: 4 })).status, 409);
  const s = await stats(); assert.equal(s.checkinCount, 1); assert.equal(s.actualHeadcount, 3); assert.equal(s.giftCount, 0);
});

test('确认及补录拒绝缺失、小数、负数、超限、字符串和儿童超总人数，非法请求不写入', async () => {
  const sub = await request('/api/checkin/self', 'POST', { name: '人数非法验收', submissionKey: randomUUID() });
  for (const patch of [{ actualHeadcount: undefined }, { actualChildrenCount: undefined }, { actualHeadcount: 0 }, { actualHeadcount: -1 }, { actualHeadcount: 1.5 }, { actualHeadcount: 21 }, { actualHeadcount: '3' }, { actualHeadcount: null }, { actualHeadcount: true }, { actualChildrenCount: 4 }, { actualChildrenCount: -1 }, { actualChildrenCount: 0.5 }]) {
    const body = { ...counts, ...patch, amount: 0 };
    assert.equal((await request(`/api/checkins/${sub.body.data.id}/confirm`, 'PATCH', body)).status, 400, JSON.stringify(patch));
    assert.equal((await manual('非法补录', patch)).status, 400, JSON.stringify(patch));
    assert.equal(row(sub.body.data.id).status, 'pending');
    assert.equal(row(sub.body.data.id).actual_headcount, null);
  }
  assert.equal((await stats()).checkinCount, 0);
  assert.equal((sqlite.prepare('SELECT count(*) n FROM guests WHERE name=?').get('非法补录') as any).n, 0);
});

test('管理员更正人数保留前后值和原因，过时更正与工作人员修改不能覆盖记录', async () => {
  const result = await manual(); const id = result.body.data.id;
  const body = { actualHeadcount: 4, actualChildrenCount: 2, expectedHeadcount: 3, expectedChildrenCount: 1, reason: '补到一名儿童' };
  assert.equal((await request(`/api/checkins/${id}/attendance`, 'PATCH', body, 'staff')).status, 403);
  assert.equal((await request(`/api/checkins/${id}/attendance`, 'PATCH', { ...body, actualChildrenCount: 5 })).status, 400);
  assert.equal((await request(`/api/checkins/${id}/attendance`, 'PATCH', { ...body, reason: ' ' })).status, 400);
  assert.equal((await request(`/api/checkins/${id}/attendance`, 'PATCH', body)).status, 200);
  assert.equal((await stats()).actualHeadcount, 4); assert.equal((await stats()).checkinCount, 1);
  assert.equal((await request(`/api/checkins/${id}/attendance`, 'PATCH', { ...body, actualHeadcount: 5 })).status, 409);
  const history = (await request(`/api/lifecycle/checkin/${id}/history`)).body.data;
  assert.equal(history.length, 1); assert.equal(history[0].reason, body.reason); assert.equal(history[0].actorName, 'admin');
  assert.match(history[0].detail, /3人.*儿童1人.*4人.*儿童2人/);
  const log = sqlite.prepare('SELECT * FROM operation_logs').get() as any;
  assert.equal(JSON.parse(log.before_json).actualHeadcount, 3); assert.equal(JSON.parse(log.after_json).actualHeadcount, 4);
});

test('审计失败回滚人数更正，未确认或撤销的签到不能更正', async () => {
  const id = (await manual()).body.data.id;
  const body = { actualHeadcount: 4, actualChildrenCount: 1, expectedHeadcount: 3, expectedChildrenCount: 1, reason: '现场重新清点' };
  sqlite.exec("CREATE TRIGGER fail_attendance_log BEFORE INSERT ON operation_logs BEGIN SELECT RAISE(ABORT,'failure'); END;");
  try { assert.equal((await request(`/api/checkins/${id}/attendance`, 'PATCH', body)).status, 500); }
  finally { sqlite.exec('DROP TRIGGER fail_attendance_log'); }
  assert.equal(row(id).actual_headcount, 3);
  await action('checkin', id, 'cancel');
  assert.equal((await request(`/api/checkins/${id}/attendance`, 'PATCH', body)).status, 409);
  const sub = await request('/api/checkin/self', 'POST', { name: '未确认', submissionKey: randomUUID() });
  assert.equal((await request(`/api/checkins/${sub.body.data.id}/attendance`, 'PATCH', { ...body, expectedHeadcount: null, expectedChildrenCount: null })).status, 409);
});

test('归档不抹掉到场人数，撤销减少人数及组数，恢复原数且不重复计礼金', async () => {
  const result = await manual('撤销三人', { amount: 60000 }); const id = result.body.data.id;
  await action('guest', result.body.data.guestId, 'archive');
  assert.equal((await stats()).actualHeadcount, 3);
  const preview = await request(`/api/lifecycle/checkin/${id}/preview?action=cancel`);
  assert.match(preview.body.data.effect, /减少1组、3人/);
  await action('checkin', id, 'cancel');
  const cancelled = await stats(); assert.equal(cancelled.actualHeadcount, 0); assert.equal(cancelled.checkinCount, 0); assert.equal(cancelled.actualChildrenCount, 0); assert.equal(cancelled.giftTotal, 60000);
  await action('guest', result.body.data.guestId, 'restore');
  await action('checkin', id, 'restore');
  assert.equal((await stats()).actualHeadcount, 3); assert.equal((await stats()).checkinCount, 1); assert.equal((await stats()).giftCount, 1);
});

test('历史签到标记人数待补记，补记前不假设1人，补记后汇总及导出一致', async () => {
  const id = Number(sqlite.prepare("INSERT INTO checkins (guest_name,status,submitted_at,confirmed_at) VALUES ('历史签到','confirmed',1,2)").run().lastInsertRowid);
  const s = await stats(); assert.equal(s.actualHeadcount, 0); assert.equal(s.checkinCount, 1); assert.equal(s.unknownHeadcountGroups, 1);
  assert.equal((await request('/api/checkins')).body.data.items[0].actualHeadcount, null);
  assert.equal((await request(`/api/checkins/${id}/attendance`, 'PATCH', { actualHeadcount: 3, actualChildrenCount: 1, expectedHeadcount: null, expectedChildrenCount: null, reason: '核对历史签到' })).status, 200);
  assert.equal((await stats()).unknownHeadcountGroups, 0); assert.equal((await stats()).actualHeadcount, 3);
  await action('checkin', id, 'cancel');
  const res = await app.request('/api/export/checkins', { headers: { Cookie: cookies.admin } });
  const book = new ExcelJS.Workbook(); await book.xlsx.load(Buffer.from(await res.arrayBuffer()) as any);
  const sheet = book.worksheets[0]; const headers = sheet.getRow(1).values as string[];
  const cell = (header: string) => sheet.getRow(2).getCell(headers.indexOf(header)).value;
  assert.equal(cell('实际总人数（含儿童）'), 3); assert.equal(cell('其中儿童'), 1); assert.equal(cell('当前计入到场人数'), 0); assert.equal(cell('状态'), '已撤销');
});

test('增量迁移保留旧签到、回执及礼金，新增人数为空且重复启动迁移安全', () => {
  const legacy = new Database(join(dir, 'legacy.db'));
  try {
    for (const tag of ['0000_deep_bucky', '0001_universal_rsvp_credentials', '0002_checkin_submission_retry', '0003_safe_record_lifecycle']) {
      legacy.exec(readFileSync(new URL(`../server/db/migrations/${tag}.sql`, import.meta.url), 'utf8'));
    }
    legacy.exec("INSERT INTO checkins (id,guest_name,status,submitted_at,confirmed_at) VALUES (10,'旧签到','confirmed',1,2); INSERT INTO gifts (guest_name,amount,method,checkin_id,recorded_at) VALUES ('旧签到',60000,'cash',10,1);");
    legacy.exec(readFileSync(new URL('../server/db/migrations/0004_actual_attendance.sql', import.meta.url), 'utf8'));
    const r = legacy.prepare('SELECT * FROM checkins').get() as any;
    assert.equal(r.status, 'confirmed'); assert.equal(r.confirmed_at, 2); assert.equal(r.actual_headcount, null); assert.equal(r.actual_children_count, null);
    assert.equal((legacy.prepare('SELECT amount FROM gifts').get() as any).amount, 60000);
    runMigrations(); runMigrations();
  } finally { legacy.close(); }
});


test('回执初始人数包含儿童，非出席或异常旧值回退1人0儿童', async () => {
  const { attendanceFromRsvp } = await import('../shared/attendance');
  assert.deepEqual(attendanceFromRsvp({ attending: 'yes', headcount: 5, childrenCount: 2 }), { actualHeadcount: 5, actualChildrenCount: 2 });
  for (const guest of [undefined, { attending: null, headcount: null, childrenCount: null }, { attending: 'no', headcount: 0, childrenCount: 0 }, { attending: 'maybe', headcount: 0, childrenCount: 0 }, { attending: 'yes', headcount: 1, childrenCount: 2 }, { attending: 'yes', headcount: 1.5, childrenCount: 0 }, { attending: 'yes', headcount: 21, childrenCount: 0 }]) {
    assert.deepEqual(attendanceFromRsvp(guest as any), { actualHeadcount: 1, actualChildrenCount: 0 });
  }
});
