import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';

const dir = mkdtempSync(join(tmpdir(), 'wedding-validation-'));
process.env.DB_PATH = join(dir, 'test.db');
const { sqlite } = await import('../server/db/client');
const { runMigrations } = await import('../server/db/migrate');
const { createToken } = await import('../server/auth/jwt');
const { guestRoutes } = await import('../server/routes/guests');
const { giftRoutes } = await import('../server/routes/gifts');
const { inviteRoutes } = await import('../server/routes/invite');
const { rsvpRoutes } = await import('../server/routes/rsvps');
const { checkinRoutes } = await import('../server/routes/checkins');
const { buildWorkbook } = await import('../server/services/excel');
runMigrations();
const app = new Hono().route('/api/guests', guestRoutes).route('/api/gifts', giftRoutes).route('/api/invite', inviteRoutes)
  .route('/api/rsvps', rsvpRoutes).route('/api/checkins', checkinRoutes);
app.onError((_, c) => c.json({ ok: false, error: { code: 'INTERNAL' } }, 500));
const cookie = `wedding_session=${await createToken({ id: 1, username: 'admin', role: 'admin' })}`;
let ip = 0;
async function request(path: string, method = 'GET', body?: unknown) {
  if (method === 'PATCH' && /^\/api\/gifts\/\d+$/.test(path) && body && typeof body === 'object' && !Array.isArray(body)) {
    const current = sqlite.prepare('SELECT version FROM gifts WHERE id=?').get(Number(path.split('/').pop())) as any;
    body = { expectedVersion: current?.version ?? 1, reason: '验收更正', ...body };
  }
  const response = await app.request(path, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-Forwarded-For': `198.51.100.${++ip}` }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() as any };
}
function guest(name = '校验验收') {
  return Number(sqlite.prepare(`INSERT INTO guests (name,invite_token,created_at,updated_at) VALUES (?,lower(hex(randomblob(16))),1,1)`).run(name).lastInsertRowid);
}
const snapshot = () => Object.fromEntries(['guests', 'rsvps', 'gifts'].map((t) => [t, sqlite.prepare(`SELECT * FROM ${t} ORDER BY id`).all()]));
const giftPayload = { guestName: '校验验收', amount: 60000, method: 'cash' };
const rsvpPayload = { attending: 'yes', headcount: 3, childrenCount: 1, message: '期待见面' };
function token(id: number) { return (sqlite.prepare('SELECT invite_token FROM guests WHERE id=?').get(id) as any).invite_token; }
beforeEach(() => sqlite.exec('DELETE FROM gifts; DELETE FROM checkins; DELETE FROM rsvps; DELETE FROM guests;'));
after(() => { sqlite.close(); rmSync(dir, { recursive: true, force: true }); });

test('专属回执拒绝非法枚举、小数、负数、字符串、空值及儿童超总数，不改宾客状态', async () => {
  const id = guest(); const before = snapshot();
  for (const patch of [{ attending: 'invalid' }, { headcount: 1.5 }, { headcount: -1 }, { headcount: '3' }, { headcount: null }, { headcount: 21 }, { childrenCount: 4 }, { childrenCount: true }, { message: 'a'.repeat(501) }]) {
    assert.equal((await request(`/api/invite/${token(id)}/rsvp`, 'POST', { ...rsvpPayload, ...patch })).status, 400, JSON.stringify(patch));
    assert.deepEqual(snapshot(), before);
  }
});

test('后台回执按合并后的完整值校验，单改总人数也不能低于已存儿童人数', async () => {
  const id = guest(); const saved = await request(`/api/invite/${token(id)}/rsvp`, 'POST', { ...rsvpPayload, childrenCount: 2 });
  const rsvpId = saved.body.data.id; const before = snapshot();
  for (const patch of [{ headcount: 1 }, { headcount: 0 }, { headcount: 0.5 }, { childrenCount: 4 }, { attending: 'bad' }, { guestId: 99 }, null, []]) {
    assert.equal((await request(`/api/rsvps/${rsvpId}`, 'PATCH', patch)).status, 400);
    assert.deepEqual(snapshot(), before);
  }
  assert.equal((await request(`/api/rsvps/${rsvpId}`, 'PATCH', { attending: 'no' })).status, 200);
  const row = (snapshot() as any).rsvps[0]; assert.equal(row.headcount, 0); assert.equal(row.children_count, 0);
});

test('专属不出席和待定统一人数归零，再改为出席必须填写至少1人', async () => {
  const id = guest();
  for (const attending of ['no', 'maybe']) {
    const saved = await request(`/api/invite/${token(id)}/rsvp`, 'POST', { ...rsvpPayload, attending });
    assert.equal(saved.status, 200); assert.equal(saved.body.data.headcount, 0); assert.equal(saved.body.data.childrenCount, 0);
  }
});

test('礼金拒绝空值、布尔值、数字字符串、小数分、0、负数、超限和非法方式，绝不静默变成0元', async () => {
  const before = snapshot();
  for (const patch of [{ amount: null }, { amount: true }, { amount: '60000' }, { amount: 1.5 }, { amount: 0 }, { amount: -1 }, { amount: 10000001 }, { method: 'bad' }, { guestName: ' ' }, { note: 'a'.repeat(501) }]) {
    assert.equal((await request('/api/gifts', 'POST', { ...giftPayload, ...patch })).status, 400, JSON.stringify(patch));
    assert.deepEqual(snapshot(), before);
  }
});

test('关联礼金须有真实同名宾客ID；同名不同人明确按ID分别关联，独立礼金不猜测', async () => {
  const a = guest(); const b = guest(); const other = guest('另一个姓名');
  for (const guestId of [999999, other, -1, 1.2, '1']) {
    assert.equal((await request('/api/gifts', 'POST', { ...giftPayload, guestId })).status, 400);
  }
  for (const guestId of [a,b]) {
    const saved = await request('/api/gifts', 'POST', { ...giftPayload, guestId });
    assert.equal(saved.status, 200); assert.equal(saved.body.data.guestId, guestId);
  }
  const independent = await request('/api/gifts', 'POST', giftPayload);
  assert.equal(independent.status, 200); assert.equal(independent.body.data.guestId, null);
});

test('修改礼金也拒绝非法金额、改绑宾客、改名、伪造作废状态，失败不改原记录', async () => {
  const saved = await request('/api/gifts', 'POST', giftPayload); const id = saved.body.data.id; const before = snapshot();
  for (const patch of [{ amount: -1 }, { amount: null }, { amount: 0.5 }, { method: 'bad' }, { guestName: '改名' }, { guestId: 999 }, { voidedAt: null }, {}, []]) {
    assert.equal((await request(`/api/gifts/${id}`, 'PATCH', patch)).status, 400, JSON.stringify(patch));
    assert.deepEqual(snapshot(), before);
  }
  assert.equal((await request(`/api/gifts/${id}`, 'PATCH', { amount: 12345, method: 'wechat' })).status, 200);
});

test('宾客新增修改拒绝空名、超长字段、非法归属与受保护字段，合法修改保留关联', async () => {
  for (const patch of [{ name: ' ' }, { name: 'a'.repeat(51) }, { name: '测试', side: 'invalid' }, { name: '测试', phone: {} }, { name: '测试', status: 'rsvp' }]) {
    assert.equal((await request('/api/guests', 'POST', patch)).status, 400);
  }
  const id = guest(); const before = snapshot();
  for (const patch of [{ name: '' }, { side: 'invalid' }, { archivedAt: 123 }, { inviteToken: 'forged' }, {}]) {
    assert.equal((await request(`/api/guests/${id}`, 'PATCH', patch)).status, 400); assert.deepEqual(snapshot(), before);
  }
  assert.equal((await request(`/api/guests/${id}`, 'PATCH', { groupName: '朋友', side: 'male' })).status, 200);
});

test('所有列表分页为有限正整数，非法路径编号和枚举返回400而不是SQL异常', async () => {
  const id = guest();
  for (const path of ['/api/guests?page=1.5', '/api/rsvps?pageSize=Infinity', '/api/gifts?page=-1', '/api/checkins?page=NaN', '/api/guests?side=bad', '/api/rsvps?attending=bad', '/api/gifts?method=bad', '/api/checkins?status=bad']) {
    assert.equal((await request(path)).status, 400, path);
  }
  for (const path of ['/api/guests/no/detail', '/api/guests/1.5', '/api/gifts/-1', '/api/rsvps/Infinity']) {
    assert.equal((await request(path, path.endsWith('/detail') ? 'GET' : 'PATCH', path.endsWith('/detail') ? undefined : { note: '不应写入' })).status, 400, path);
  }
  assert.equal((await request('/api/guests?page=1&pageSize=10000')).body.data.pageSize, 100);
  assert.ok(id);
});

test('损坏JSON、非对象请求和损坏Excel都返回可理解的400且不写入', async () => {
  const before = snapshot();
  for (const path of ['/api/guests', '/api/gifts']) {
    const raw = await app.request(path, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: '{bad' });
    assert.equal(raw.status, 400);
    assert.equal((await request(path, 'POST', [])).status, 400);
  }
  const form = new FormData(); form.set('file', new File(['not-an-excel'], 'broken.xlsx'));
  assert.equal((await app.request('/api/guests/import', { method: 'POST', headers: { Cookie: cookie }, body: form })).status, 400);
  assert.deepEqual(snapshot(), before);
});

test('Excel导入沿用宾客字段校验，错误行有行号与原因，合法行仍可导入', async () => {
  const buffer = await buildWorkbook([{ name: '宾客', columns: [{ header: '姓名', key: 'name' }, { header: '归属方', key: 'side' }], rows: [{ name: '合法宾客', side: '男方' }, { name: 'a'.repeat(51), side: '女方' }, { name: '错误归属', side: '未知归属' }] }]);
  const form = new FormData(); form.set('file', new File([new Uint8Array(buffer)], 'test.xlsx'));
  const res = await app.request('/api/guests/import', { method: 'POST', headers: { Cookie: cookie }, body: form });
  assert.equal(res.status, 200); const body = await res.json() as any;
  assert.equal(body.data.created, 1); assert.deepEqual(body.data.failed.map((r: any) => r.row), [3,4]);
  assert.equal((snapshot() as any).guests[0].side, 'male');
});


test('只修改部分字段不会清空原儿童人数、留言或礼金备注', async () => {
  const id = guest();
  const saved = await request(`/api/invite/${token(id)}/rsvp`, 'POST', rsvpPayload);
  const updated = await request(`/api/rsvps/${saved.body.data.id}`, 'PATCH', { headcount: 2 });
  assert.equal(updated.status, 200); assert.equal(updated.body.data.childrenCount, 1); assert.equal(updated.body.data.message, rsvpPayload.message);
  const gift = await request('/api/gifts', 'POST', { ...giftPayload, note: '保留备注' });
  const changed = await request(`/api/gifts/${gift.body.data.id}`, 'PATCH', { amount: 12345 });
  assert.equal(changed.body.data.note, '保留备注');
});


test('界面按实际输入精确换算金额和人数，非法新输入不能复用旧值或自动舍入', async () => {
  const { parseGiftYuan, parseCheckinYuan, parseHeadcount } = await import('../shared/numericInput');
  assert.equal(parseCheckinYuan('0'), 0); assert.equal(parseCheckinYuan('1.234'), null);
  assert.equal(parseGiftYuan('600'), 60000); assert.equal(parseGiftYuan('123.45'), 12345);
  assert.equal(parseGiftYuan('0.01'), 1); assert.equal(parseGiftYuan('100000.00'), 10000000);
  for (const v of ['0', '', '1.234', '-1', '100000.01', '1e3', '600x', null, 600]) assert.equal(parseGiftYuan(v), null);
  for (const v of ['0','1','20']) assert.equal(parseHeadcount(v), Number(v));
  for (const v of ['1.5','21','-1','','1e1',null]) assert.equal(parseHeadcount(v), null);
});
