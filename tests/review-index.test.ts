import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
const dir = mkdtempSync(join(tmpdir(), 'review-index-'));
process.env.DB_PATH = join(dir, 'test.db');
const { sqlite } = await import('../server/db/client');
const { runMigrations } = await import('../server/db/migrate');
const { createToken } = await import('../server/auth/jwt');
const { guestRoutes } = await import('../server/routes/guests');
runMigrations();
const app = new Hono().route('/api/guests', guestRoutes);
const cookies = {
  admin: `wedding_session=${await createToken({ id: 1, username: 'admin', role: 'admin' })}`,
  staff: `wedding_session=${await createToken({ id: 2, username: 'staff', role: 'staff' })}`,
};
const request = (query = '', role: 'admin' | 'staff' = 'admin') => app.request(`/api/guests/workbench${query}`, { headers: { Cookie: cookies[role] } });
const data = async (query = '', role: 'admin' | 'staff' = 'admin') => (await (await request(query, role)).json() as any).data;
sqlite.exec(`INSERT INTO guests (id,name,note,phone,invite_token,group_name,side,created_at,updated_at,archived_at) VALUES
 (1,'陈星满','私人备注','13812345678','private-token','同事','male',1,1,NULL),
 (2,'陈星满',NULL,NULL,'token2','同学','female',1,1,NULL),
 (3,'归档宾客',NULL,NULL,'token3','亲友','male',1,1,2),
 (4,'历史来宾',NULL,NULL,'token4','亲友','both',1,1,NULL);
 INSERT INTO rsvps (guest_id,guest_name,attending,headcount,children_count,submitted_at,updated_at) VALUES
 (1,'陈星满','yes',2,0,1,1),(1,'陈星满','yes',3,1,2,2),(2,'陈星满','no',1,0,2,2);
 INSERT INTO checkins (id,guest_id,guest_name,status,submitted_at,confirmed_at,actual_headcount,actual_children_count) VALUES
 (10,1,'陈星满','confirmed',3,4,2,0),(11,1,'陈星满','cancelled',5,6,9,0),
 (12,NULL,'陈星满','pending',7,NULL,NULL,NULL),(13,NULL,'陈星满','pending',8,NULL,NULL,NULL),
 (14,4,'历史来宾','confirmed',1,2,NULL,NULL),(15,2,'陈星满','pending',9,NULL,NULL,NULL);
 INSERT INTO gifts (guest_id,guest_name,amount,method,recorded_at,voided_at) VALUES
 (1,'陈星满',188800,'cash',3,NULL),(1,'陈星满',50000,'cash',3,4),(2,'陈星满',60000,'cash',3,NULL);`);
after(() => { sqlite.close(); rmSync(dir, { recursive: true, force: true }); });
test('同名档案及未匹配扫码按ID独立显示，不因查询提前建档', async () => {
  const before = sqlite.prepare('SELECT COUNT(*) AS n FROM guests').get();
  const result = await data(); assert.equal(result.total, 5);
  assert.equal(new Set(result.items.map((r: any) => r.key)).size, 5);
  assert.equal(result.items.filter((r: any) => r.guestId == null).length, 2);
  assert.deepEqual(sqlite.prepare('SELECT COUNT(*) AS n FROM guests').get(), before);
  assert.equal(result.items.some((r: any) => r.guestId === 3), false);
});
test('取最新回执、有效签到和有效礼金，保留未知实到人数', async () => {
  const rows = (await data()).items;
  const row = rows.find((r: any) => r.guestId === 1);
  assert.equal(row.expected, 3); assert.equal(row.actual, 2); assert.equal(row.giftTotal, 188800); assert.equal(row.status, 'confirmed');
  assert.equal(rows.find((r: any) => r.guestId === 4).actual, null);
  assert.equal(rows.find((r: any) => r.guestId === 2).expected, null);
  assert.equal(rows.find((r: any) => r.guestId === 2).pendingId, 15);
});
test('工作人员不返回金额、私人备注、手机号和凭证', async () => {
  const result = await data('', 'staff');
  assert.equal(result.total, 5);
  assert.doesNotMatch(JSON.stringify(result), /giftTotal|188800|60000|私人备注|13812345678|private-token|"note"/);
  assert.deepEqual(Object.keys(result.items[0]).sort(), ['key','guestId','name','groupName','side','expected','actual','status','pendingId','time'].sort());
});
test('筛选先于分页，按分组和归属查找且不串同名记录', async () => {
  assert.equal((await data('?status=pending')).total, 3);
  assert.equal((await data('?status=confirmed')).total, 2);
  const group = await data('?keyword=同事&side=male'); assert.equal(group.total, 1); assert.equal(group.items[0].guestId, 1);
  const one = await data('?pageSize=1&page=1'); const two = await data('?pageSize=1&page=2');
  assert.equal(one.total, 5); assert.equal(one.items.length, 1); assert.notEqual(one.items[0].key, two.items[0].key);
});
test('恶意搜索按字面绑定，不扩大结果；未登录和非法参数拒绝', async () => {
  assert.equal((await data('?keyword='+encodeURIComponent("' OR 1=1 --"))).total, 0);
  assert.equal((await app.request('/api/guests/workbench')).status, 401);
  for (const q of ['?page=0','?status=invalid','?side=invalid']) assert.equal((await request(q)).status, 400);
});


test('详情按宾客ID读取现场状态，撤销后不受已签到筛选或同名记录影响', async () => {
  assert.equal((await data('?guestId=1')).items[0].status, 'confirmed');
  sqlite.exec("UPDATE checkins SET status='cancelled' WHERE guest_id=1 AND status='confirmed'");
  try {
    const result = await data('?guestId=1', 'staff');
    assert.equal(result.total, 1);
    assert.equal(result.items[0].guestId, 1);
    assert.equal(result.items[0].status, 'unconfirmed');
    assert.equal(result.items[0].actual, null);
    assert.doesNotMatch(JSON.stringify(result), /giftTotal|private-token|私人备注/);
    assert.equal((await data('?guestId=1&status=confirmed')).total, 0);
    assert.equal((await request('?guestId=bad')).status, 400);
  } finally {
    sqlite.exec("UPDATE checkins SET status='confirmed' WHERE id=10");
  }
});
