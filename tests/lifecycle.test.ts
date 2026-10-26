import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import ExcelJS from 'exceljs';
import Database from 'better-sqlite3';

const dir = mkdtempSync(join(tmpdir(), 'wedding-lifecycle-'));
process.env.DB_PATH = join(dir, 'test.db');
const { sqlite } = await import('../server/db/client');
const { runMigrations } = await import('../server/db/migrate');
const { createToken } = await import('../server/auth/jwt');
const { lifecycleRoutes } = await import('../server/routes/lifecycle');
const { guestRoutes } = await import('../server/routes/guests');
const { checkinRoutes } = await import('../server/routes/checkins');
const { giftRoutes } = await import('../server/routes/gifts');
const { inviteRoutes } = await import('../server/routes/invite');
const { statsRoutes } = await import('../server/routes/stats');
const { exportRoutes } = await import('../server/routes/export');
const { publicCheckinRoutes } = await import('../server/routes/checkin');
runMigrations();
const app = new Hono().route('/api/lifecycle', lifecycleRoutes).route('/api/guests', guestRoutes)
  .route('/api/checkins', checkinRoutes).route('/api/gifts', giftRoutes).route('/api/invite', inviteRoutes)
  .route('/api/stats', statsRoutes).route('/api/export', exportRoutes).route('/api/checkin', publicCheckinRoutes);
app.notFound((c) => c.json({ ok: false }, 404));
app.onError((_, c) => c.json({ ok: false, error: { code: 'INTERNAL', message: '写入失败' } }, 500));
const cookies = {
  admin: `wedding_session=${await createToken({ id: 1, username: 'admin', role: 'admin' })}`,
  staff: `wedding_session=${await createToken({ id: 2, username: 'staff', role: 'staff' })}`,
};
let ip = 0;
async function request(path: string, method = 'GET', body?: object, role: 'admin' | 'staff' = 'admin') {
  if (path === '/api/gifts' && method === 'POST' && body && typeof body === 'object' && !Array.isArray(body)) body = { submissionKey: randomUUID(), ...body };
  if (body && (path === '/api/checkins' || path.endsWith('/confirm'))) body = { actualHeadcount: 1, actualChildrenCount: 0, ...body };
  if (method === 'PATCH' && /^\/api\/gifts\/\d+$/.test(path) && body && typeof body === 'object' && !Array.isArray(body)) {
    const current = sqlite.prepare('SELECT version FROM gifts WHERE id=?').get(Number(path.split('/').pop())) as any;
    body = { expectedVersion: current?.version ?? 1, reason: '验收更正', ...body };
  }
  const response = await app.request(path, { method, headers: { Cookie: cookies[role], 'Content-Type': 'application/json', 'X-Forwarded-For': `192.0.2.${++ip}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() as any };
}
const preview = (entity: string, id: number, action: string, role: 'admin' | 'staff' = 'admin') => request(`/api/lifecycle/${entity}/${id}/preview?action=${action}`, 'GET', undefined, role);
async function apply(entity: string, id: number, action: string, role: 'admin' | 'staff' = 'admin') {
  const p = await preview(entity, id, action, role);
  if (p.status !== 200) return p;
  return request(`/api/lifecycle/${entity}/${id}`, 'POST', { action, reason: '核对后的验收操作', token: p.body.data.token }, role);
}
function fixture(status = 'confirmed') {
  const guest = Number(sqlite.prepare(`INSERT INTO guests (name,invite_token,status,created_at,updated_at) VALUES ('安全操作验收','safe-token','rsvp',1,1)`).run().lastInsertRowid);
  sqlite.prepare(`INSERT INTO rsvps (guest_id,guest_name,attending,headcount,submitted_at,updated_at) VALUES (?,'安全操作验收','yes',3,1,1)`).run(guest);
  const checkin = Number(sqlite.prepare(`INSERT INTO checkins (guest_id,guest_name,status,submitted_at,confirmed_at) VALUES (?,'安全操作验收',?,1,2)`).run(guest, status).lastInsertRowid);
  const gift = Number(sqlite.prepare(`INSERT INTO gifts (guest_id,guest_name,amount,method,checkin_id,recorded_at) VALUES (?,'安全操作验收',60000,'cash',?,1)`).run(guest, checkin).lastInsertRowid);
  return { guest, checkin, gift };
}
const get = (table: string, id: number) => sqlite.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id) as any;
const stats = async () => (await request('/api/stats/summary')).body.data;
beforeEach(() => sqlite.exec('DELETE FROM operation_logs; DELETE FROM gifts; DELETE FROM checkins; DELETE FROM rsvps; DELETE FROM guests;'));
after(() => { sqlite.close(); rmSync(dir, { recursive: true, force: true }); });

test('归档保留关联、暂停专属回执、排除预计出席且不影响已到场和礼金，恢复不重建', async () => {
  const { guest, checkin, gift } = fixture();
  assert.equal((await apply('guest', guest, 'archive')).status, 200);
  assert.ok(get('guests', guest).archived_at);
  assert.equal(get('checkins', checkin).guest_id, guest); assert.equal(get('gifts', gift).guest_id, guest);
  assert.equal((await request('/api/guests')).body.data.total, 0);
  assert.equal((await request('/api/guests?archived=only')).body.data.total, 1);
  assert.equal((await request('/api/invite/safe-token')).status, 404);
  assert.equal((await request('/api/invite/safe-token/rsvp', 'POST', { attending: 'yes', headcount: 5 })).status, 404);
  const archivedStats = await stats();
  assert.equal(archivedStats.guestTotal, 0); assert.equal(archivedStats.attendingHeadcount, 0);
  assert.equal(archivedStats.checkinCount, 1); assert.equal(archivedStats.giftTotal, 60000);
  assert.equal((await apply('guest', guest, 'restore')).status, 200);
  assert.equal((await stats()).attendingHeadcount, 3); assert.equal((await stats()).giftTotal, 60000);
  assert.equal((await request('/api/invite/safe-token')).status, 200);
});

test('作废退出有效汇总但保留原金额和签到关联，恢复只恢复原账目', async () => {
  const { guest, checkin, gift } = fixture();
  const p = await preview('gift', gift, 'void');
  assert.equal(p.body.data.checkinCount, 1); assert.equal(p.body.data.rsvpCount, 1);
  assert.equal((await apply('gift', gift, 'void')).status, 200);
  assert.equal(get('gifts', gift).amount, 60000); assert.equal(get('gifts', gift).checkin_id, checkin);
  assert.equal(get('checkins', checkin).status, 'confirmed');
  assert.equal((await stats()).giftTotal, 0); assert.equal((await stats()).checkinCount, 1);
  assert.equal((await request('/api/gifts')).body.data.total, 0);
  assert.equal((await request('/api/gifts?state=all')).body.data.summary.total, 0);
  assert.equal((await request(`/api/guests/${guest}/detail`)).body.data.giftTotal, 0);
  assert.equal((await request(`/api/gifts/${gift}`, 'PATCH', { amount: 123 })).status, 409);
  const recovery = await preview('gift', gift, 'restore');
  assert.equal(recovery.body.data.originalGiftTotal, 60000); assert.equal(recovery.body.data.giftTotal, 0);
  assert.match(recovery.body.data.effect, /增加 ¥600.00/);
  assert.equal((await apply('gift', gift, 'restore')).status, 200);
  assert.equal((await stats()).giftTotal, 60000);
  assert.equal((sqlite.prepare('SELECT count(*) AS n FROM gifts').get() as any).n, 1);
});

test('工作人员不能归档宾客，旧删除接口无法绕过', async () => {
  const { guest, checkin, gift } = fixture();
  assert.equal((await app.request(`/api/lifecycle/guest/${guest}/preview?action=archive`)).status, 401);
  for (const [entity, id, action] of [['guest', guest, 'archive']] as const) {
    const p = await preview(entity, id, action);
    assert.equal((await preview(entity, id, action, 'staff')).status, 403);
    assert.equal((await request(`/api/lifecycle/${entity}/${id}`, 'POST', { action, reason: '越权', token: p.body.data.token }, 'staff')).status, 403);
  }
  for (const [entity, id] of [['guests', guest], ['checkins', checkin], ['gifts', gift]] as const) {
    assert.equal((await request(`/api/${entity}/${id}`, 'DELETE')).status, 409);
  }
  assert.equal((await request(`/api/checkins/${checkin}`, 'DELETE', undefined, 'staff')).status, 409);
  assert.equal((await stats()).giftTotal, 60000);
});

test('撤销签到不影响礼金；恢复确认不重复创建礼金，也保留首次确认时间', async () => {
  const { checkin } = fixture();
  assert.equal((await apply('checkin', checkin, 'cancel')).status, 200);
  assert.equal((await stats()).checkinCount, 0); assert.equal((await stats()).giftTotal, 60000);
  assert.equal((await request(`/api/checkins/${checkin}/confirm`, 'PATCH', { amount: 60000 })).status, 409);
  assert.equal((await apply('checkin', checkin, 'restore')).status, 200);
  assert.equal(get('checkins', checkin).confirmed_at, 2);
  assert.equal((await stats()).checkinCount, 1); assert.equal((await stats()).giftCount, 1);
});

test('待审驳回只改状态，保留映射和历史；原标识不重新提交，新标识可登记', async () => {
  const { guest, checkin } = fixture('pending');
  const key = randomUUID();
  const submitted = await request('/api/checkin/self', 'POST', { name: '安全操作验收', submissionKey: key });
  const id = submitted.body.data.id;
  assert.equal((await apply('checkin', id, 'reject', 'staff')).status, 200);
  assert.equal(get('checkins', id).status, 'rejected');
  const replay = await request('/api/checkin/self', 'POST', { name: '安全操作验收', submissionKey: key });
  assert.equal(replay.body.data.id, id); assert.equal(replay.body.data.status, 'rejected');
  assert.equal((await request(`/api/checkins/${id}/confirm`, 'PATCH', { guestId: guest, amount: 0 })).status, 409);
  assert.equal((await apply('checkin', checkin, 'reject', 'staff')).status, 200);
  assert.equal((await request('/api/checkins/pending')).body.data.length, 0);
  assert.equal((await apply('checkin', id, 'restore', 'staff')).status, 200);
  assert.equal((await request('/api/checkins/pending')).body.data.length, 1);
});

test('缺失原因、伪造或过期影响令牌均不写入；关联记录变更须重新核对', async () => {
  const { guest, gift } = fixture();
  const p = await preview('guest', guest, 'archive');
  for (const reason of ['', '   ', 'a'.repeat(201)]) {
    assert.equal((await request(`/api/lifecycle/guest/${guest}`, 'POST', { action: 'archive', reason, token: p.body.data.token })).status, 400);
  }
  assert.equal((await request(`/api/lifecycle/guest/${guest}`, 'POST', { action: 'archive', reason: '原因', token: '0'.repeat(64) })).status, 409);
  sqlite.prepare('UPDATE gifts SET amount=80000 WHERE id=?').run(gift);
  const stale = await request(`/api/lifecycle/guest/${guest}`, 'POST', { action: 'archive', reason: '原因', token: p.body.data.token });
  assert.equal(stale.status, 409); assert.equal(stale.body.error.code, 'STALE_PREVIEW');
  assert.equal(get('guests', guest).archived_at, null);
});

test('状态变化防止重复操作；恢复签到时不能绕过另一条有效签到', async () => {
  const { guest, checkin, gift } = fixture();
  const p = await preview('gift', gift, 'void');
  const body = { action: 'void', reason: '误录', token: p.body.data.token };
  const [a,b] = await Promise.all([request(`/api/lifecycle/gift/${gift}`, 'POST', body), request(`/api/lifecycle/gift/${gift}`, 'POST', body)]);
  assert.deepEqual([a.status,b.status].sort(), [200,409]);
  assert.equal((sqlite.prepare('SELECT count(*) AS n FROM operation_logs').get() as any).n, 1);
  await apply('checkin', checkin, 'cancel');
  sqlite.prepare(`INSERT INTO checkins (guest_id,guest_name,status,submitted_at) VALUES (?,'安全操作验收','confirmed',1)`).run(guest);
  assert.equal((await apply('checkin', checkin, 'restore')).status, 409);
});

test('审计写入失败整体回滚，成功记录操作者原因及前后值且不能通过接口修改历史', async () => {
  const { gift } = fixture();
  sqlite.exec("CREATE TRIGGER fail_log BEFORE INSERT ON operation_logs BEGIN SELECT RAISE(ABORT,'failure'); END;");
  try { assert.equal((await apply('gift', gift, 'void')).status, 500); assert.equal(get('gifts', gift).voided_at, null); }
  finally { sqlite.exec('DROP TRIGGER fail_log'); }
  assert.equal((await apply('gift', gift, 'void')).status, 200);
  const history = (await request(`/api/lifecycle/gift/${gift}/history`)).body.data;
  assert.equal(history[0].actorName, 'admin'); assert.equal(history[0].reason, '核对后的验收操作');
  const log = sqlite.prepare('SELECT * FROM operation_logs').get() as any;
  assert.equal(JSON.parse(log.before_json).voidedAt, null); assert.ok(JSON.parse(log.after_json).voidedAt);
  assert.equal((await request(`/api/lifecycle/gift/${gift}/history`, 'DELETE')).status, 404);
});

test('归档宾客不能被签到候选、确认或慢请求重新启用，恢复后才可核对', async () => {
  const { guest, checkin } = fixture('pending');
  await apply('guest', guest, 'archive');
  assert.deepEqual((await request('/api/checkins/candidates?name='+encodeURIComponent('安全操作验收'))).body.data, []);
  assert.equal((await request(`/api/checkins/${checkin}/confirm`, 'PATCH', { guestId: guest, amount: 0 })).status, 409);
  assert.equal((await request(`/api/guests/${guest}`, 'PATCH', { name: '误改' })).status, 409);
  assert.equal((await request('/api/checkins/pending')).body.data[0].guestArchived, true);
});

test('导出保留作废与撤销标记，礼金原金额与有效金额分别列出', async () => {
  const { checkin, gift } = fixture();
  await apply('gift', gift, 'void'); await apply('checkin', checkin, 'cancel');
  const res = await app.request('/api/export/gifts', { headers: { Cookie: cookies.admin } });
  assert.equal(res.status, 200);
  const book = new ExcelJS.Workbook(); await book.xlsx.load(Buffer.from(await res.arrayBuffer()) as any);
  const sheet = book.worksheets[0];
  const headers = sheet.getRow(1).values as string[];
  assert.equal(sheet.getRow(2).getCell(headers.indexOf('状态')).value, '已作废');
  assert.equal(sheet.getRow(2).getCell(headers.indexOf('原登记金额(元)')).value, 600);
  assert.equal(sheet.getRow(2).getCell(headers.indexOf('有效金额(元)')).value, 0);
});


test('升级迁移只新增可空状态与审计表，旧宾客回执签到礼金及关联原样保留', () => {
  const legacy = new Database(join(dir, 'legacy.db'));
  try {
    for (const migration of ['0000_deep_bucky', '0001_universal_rsvp_credentials', '0002_checkin_submission_retry']) {
      legacy.exec(readFileSync(new URL(`../server/db/migrations/${migration}.sql`, import.meta.url), 'utf8'));
    }
    legacy.exec(`INSERT INTO guests (id,name,invite_token,created_at,updated_at) VALUES (10,'旧宾客','old-token',1,1);
      INSERT INTO rsvps (id,guest_id,guest_name,attending,headcount,submitted_at,updated_at) VALUES (20,10,'旧宾客','yes',3,1,1);
      INSERT INTO checkins (id,guest_id,guest_name,status,submitted_at) VALUES (30,10,'旧宾客','confirmed',1);
      INSERT INTO gifts (id,guest_id,guest_name,amount,method,checkin_id,recorded_at) VALUES (40,10,'旧宾客',60000,'cash',30,1);`);
    legacy.exec(readFileSync(new URL('../server/db/migrations/0003_safe_record_lifecycle.sql', import.meta.url), 'utf8'));
    assert.equal((legacy.prepare('SELECT archived_at FROM guests WHERE id=10').get() as any).archived_at, null);
    const gift = legacy.prepare('SELECT * FROM gifts WHERE id=40').get() as any;
    assert.equal(gift.voided_at, null); assert.equal(gift.amount, 60000); assert.equal(gift.guest_id, 10); assert.equal(gift.checkin_id, 30);
    assert.equal((legacy.prepare('SELECT headcount FROM rsvps WHERE id=20').get() as any).headcount, 3);
    assert.equal((legacy.prepare('SELECT count(*) AS n FROM operation_logs').get() as any).n, 0);
  } finally { legacy.close(); }
});

test('编辑宾客的请求体延迟期间被归档，旧编辑不能改写已归档档案', async () => {
  const { guest } = fixture();
  let release!: () => void;
  const stream = new ReadableStream({ start(controller) { release = () => {
    controller.enqueue(new TextEncoder().encode(JSON.stringify({ name: '不应写入' }))); controller.close();
  }; } });
  const slow = app.request(new Request(`http://localhost/api/guests/${guest}`, { method: 'PATCH',
    headers: { Cookie: cookies.admin, 'Content-Type': 'application/json' }, body: stream, duplex: 'half' } as RequestInit));
  assert.equal((await apply('guest', guest, 'archive')).status, 200);
  release();
  assert.equal((await slow).status, 409);
  assert.equal(get('guests', guest).name, '安全操作验收');
  assert.ok(get('guests', guest).archived_at);
});


test('历史视图按归档和撤回分别筛选，保留详情与操作原因且有效汇总排除撤回记录', async () => {
  const { guest, gift } = fixture();
  const active = Number(sqlite.prepare("INSERT INTO guests (name,invite_token,created_at,updated_at) VALUES ('当前宾客','active-token',1,1)").run().lastInsertRowid);
  await apply('guest', guest, 'archive');
  await apply('gift', gift, 'void');
  assert.deepEqual((await request('/api/guests')).body.data.items.map((g: any) => g.id), [active]);
  const archived = (await request('/api/guests?archived=only')).body.data;
  assert.deepEqual(archived.items.map((g: any) => g.id), [guest]);
  assert.ok(archived.items[0].archivedAt);
  assert.equal((await request('/api/guests?archived=all')).body.data.total, 2);
  assert.equal((await request(`/api/guests/${guest}/detail`)).body.data.gifts[0].id, gift);
  const withdrawn = (await request('/api/gifts?state=voided')).body.data;
  assert.equal(withdrawn.items[0].id, gift);
  assert.equal(withdrawn.items[0].amount, 60000);
  assert.ok(withdrawn.items[0].voidedAt);
  assert.equal(withdrawn.summary.total, 0);
  assert.equal(withdrawn.summary.count, 0);
  assert.equal((await request(`/api/lifecycle/gift/${gift}/history`)).body.data[0].reason, '核对后的验收操作');
});

test('无礼金的扫码确认与手动补录均正常签到，后续独立送礼只增加礼金不重复签到', async () => {
  const submitted = await request('/api/checkin/self', 'POST', { name: '仅签到来宾', submissionKey: randomUUID() });
  const id = submitted.body.data.id;
  assert.equal((await request(`/api/checkins/${id}/confirm`, 'PATCH', { amount: 0 })).status, 200);
  const manual = await request('/api/checkins', 'POST', { guestName: '手动仅签到', submissionKey: randomUUID() });
  assert.equal(manual.status, 200);
  assert.equal((await stats()).checkinCount, 2);
  assert.equal((await stats()).giftCount, 0);
  assert.equal((await stats()).giftTotal, 0);
  const records = (await request('/api/checkins')).body.data.items;
  assert.equal(records.length, 2);
  assert.ok(records.every((r: any) => r.status === 'confirmed' && r.giftAmount === null && r.giftMethod === null));
  const guestId = get('checkins', id).guest_id;
  assert.equal((await request('/api/gifts', 'POST', { guestName: '仅签到来宾', guestId, amount: 12345, method: 'cash' })).status, 200);
  assert.equal((await stats()).checkinCount, 2);
  assert.equal((await stats()).giftCount, 1);
  assert.equal((await stats()).giftTotal, 12345);
});
