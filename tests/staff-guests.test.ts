import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
const dir = mkdtempSync(join(tmpdir(), 'staff-guests-'));
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
const request = (path: string, role: 'admin' | 'staff' = 'staff', method = 'GET') => app.request(`/api/guests${path}`, { method, headers: { Cookie: cookies[role] } });
const data = async (path: string, role: 'admin' | 'staff' = 'staff') => (await (await request(path, role)).json() as any).data;
sqlite.exec(`INSERT INTO guests (id,name,phone,note,invite_token,group_name,side,created_at,updated_at) VALUES
 (1,'王明','13812345678','私人备注','private-token','同事','male',1,1), (2,'王明',NULL,NULL,'other-token','亲友','female',1,1);
 INSERT INTO rsvps (guest_id,guest_name,attending,headcount,children_count,message,submitted_at,updated_at) VALUES (1,'王明','yes',2,0,'私人祝福',1,1), (1,'王明','yes',3,1,'新祝福',2,2);
 INSERT INTO checkins (guest_id,guest_name,status,note,submitted_at,actual_headcount,actual_children_count) VALUES (1,'王明','confirmed','签到备注',3,2,0);
 INSERT INTO gifts (guest_id,guest_name,amount,method,note,recorded_at) VALUES (1,'王明',50000,'cash','礼金备注',3);`);
after(() => { sqlite.close(); rmSync(dir, { recursive: true, force: true }); });
test('工作人员名单仅返回白名单，同名用编号分组归属和签到区分，人数取最新回执', async () => {
  const result = await data('?keyword=王明'); assert.equal(result.total, 2);
  const guest = result.items.find((r: any) => r.id === 1);
  assert.deepEqual(Object.keys(guest).sort(), ['id','name','groupName','side','archivedAt','attending','headcount','childrenCount','checkedIn'].sort());
  assert.equal(guest.headcount, 3); assert.equal(guest.childrenCount, 1); assert.equal(guest.checkedIn, true);
  assert.equal(result.items.find((r: any) => r.id === 2).checkedIn, false);
  assert.equal((await data('?keyword=13812345678')).total, 0);
});
test('工作人员详情可用且没有凭证、联系方式、私人备注、祝福或礼金汇总', async () => {
  const detail = await data('/1/detail');
  assert.deepEqual(Object.keys(detail).sort(), ['guest','checkins','gifts'].sort());
  assert.deepEqual(Object.keys(detail.checkins[0]).sort(), ['id','status','submittedAt','confirmedAt','actualHeadcount','actualChildrenCount'].sort());
  assert.equal(detail.guest.headcount, 3);
  assert.doesNotMatch(JSON.stringify(detail), /13812345678|private-token|私人|祝福|备注|50000|giftTotal/i);
  assert.equal((await request('/999/detail')).status, 404);
});
test('工作人员无法绕过页面访问二维码、海报、导出或写入，未登录被拒绝', async () => {
  for (const path of ['/1/qr','/1/poster','/export','/posters/export']) assert.equal((await request(path)).status, 403, path);
  for (const [path, method] of [['','POST'], ['/1','PATCH'], ['/1','DELETE'], ['/1/mark-sent','POST'], ['/import','POST']]) assert.equal((await request(path!, 'staff', method)).status, 403);
  assert.equal((await app.request('/api/guests')).status, 401);
});
test('管理员完整详情及手机号搜索保留，受限处理不影响管理功能', async () => {
  const guest = (await data('?keyword=13812345678','admin')).items[0];
  assert.equal(guest.inviteToken, 'private-token'); assert.equal(guest.phone, '13812345678');
  const detail = await data('/1/detail','admin'); assert.equal(detail.giftTotal, 50000); assert.equal(detail.rsvp.message, '新祝福');
  assert.equal((await request('/1/qr','admin')).status, 200);
});


test('管理员宾客状态由有效签到决定，撤销后恢复原邀请状态且不伪造回执', async () => {
  const list = await data('', 'admin');
  assert.equal(list.items.find((row: { id: number }) => row.id === 1).checkedIn, true);
  assert.equal((await data('/1/detail', 'admin')).guest.checkedIn, true);
  sqlite.exec("UPDATE checkins SET status='cancelled' WHERE guest_id=1");
  try {
    const row = (await data('', 'admin')).items.find((row: { id: number }) => row.id === 1);
    assert.equal(row.checkedIn, false);
    assert.equal(row.status, 'pending');
    assert.equal((await data('/1/detail', 'admin')).guest.checkedIn, false);
    assert.equal((sqlite.prepare('SELECT count(*) AS n FROM rsvps').get() as { n: number }).n, 2);
  } finally {
    sqlite.exec("UPDATE checkins SET status='confirmed' WHERE guest_id=1");
  }
});
