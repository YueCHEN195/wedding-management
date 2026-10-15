import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { mkdtempSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import { Hono } from 'hono';

const testDir = mkdtempSync(join(tmpdir(), 'wedding-rsvp-'));
process.env.DB_PATH = join(testDir, 'test.db');
const { sqlite } = await import('../server/db/client');
const { runMigrations } = await import('../server/db/migrate');
const { inviteRoutes } = await import('../server/routes/invite');
runMigrations();
const app = new Hono().route('/api/invite', inviteRoutes);
const payload = { name: '同名回执测试', attending: 'yes', headcount: 2, childrenCount: 0, message: '期待见面' };
let ip = 0;

async function request(path: string, method = 'GET', body?: unknown, cookie?: string) {
  const response = await app.request('/api/invite'+path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `127.0.0.${++ip}`, ...(cookie ? { Cookie: cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() as any, cookie: response.headers.get('set-cookie')?.split(';')[0] ?? cookie, setCookie: response.headers.get('set-cookie') };
}
async function openUniversal(cookie?: string) {
  const result = await request('/rsvp', 'GET', undefined, cookie);
  assert.equal(result.status, 200);
  assert.ok(result.cookie);
  return result;
}
function addInvitedGuest() {
  return Number(sqlite.prepare(`INSERT INTO guests (name,invite_token,created_at,updated_at)
    VALUES ('同名回执测试','private-invitation',1,1)`).run().lastInsertRowid);
}
const countRsvps = () => (sqlite.prepare('SELECT count(*) AS n FROM rsvps').get() as any).n;

beforeEach(() => sqlite.exec('DELETE FROM rsvps; DELETE FROM guests;'));
after(() => { sqlite.close(); rmSync(testDir, { recursive: true, force: true }); });

test('无私有凭证时不能仅凭姓名覆盖已有专属回执', async () => {
  const guestId = addInvitedGuest();
  await request('/private-invitation/rsvp', 'POST', { ...payload, headcount: 3 });
  const attack = await request('/rsvp', 'POST', { ...payload, attending: 'no', headcount: 0, guestId });
  assert.equal(attack.status, 409);
  const row = sqlite.prepare('SELECT * FROM rsvps WHERE guest_id=?').get(guestId) as any;
  assert.equal(row.attending, 'yes');
  assert.equal(row.headcount, 3);
});

test('通用首次提交独立于同名专属宾客，不能通过请求内的ID或token指定他人', async () => {
  const guestId = addInvitedGuest();
  await request('/private-invitation/rsvp', 'POST', { ...payload, headcount: 3 });
  const session = await openUniversal();
  const saved = await request('/rsvp', 'POST', { ...payload, guestId, id: 1, token: 'private-invitation' }, session.cookie);
  assert.equal(saved.status, 200);
  assert.equal(saved.body.data.guestId, null);
  assert.equal(saved.body.data.source, 'universal');
  assert.equal((sqlite.prepare('SELECT headcount FROM rsvps WHERE guest_id=?').get(guestId) as any).headcount, 3);
  assert.equal(countRsvps(), 2);
});

test('同浏览器多次保存只更新自己的同一条回执，刷新可恢复姓名和内容', async () => {
  const session = await openUniversal();
  const first = await request('/rsvp', 'POST', payload, session.cookie);
  const second = await request('/rsvp', 'POST', { ...payload, headcount: 4, message: '更新留言' }, session.cookie);
  assert.equal(second.body.data.id, first.body.data.id);
  assert.equal(countRsvps(), 1);
  const restored = await openUniversal(session.cookie);
  assert.equal(restored.body.data.id, first.body.data.id);
  assert.equal(restored.body.data.guestName, payload.name);
  assert.equal(restored.body.data.headcount, 4);
  assert.equal(restored.body.data.message, '更新留言');
});

test('两个浏览器的同名通用回执互相独立', async () => {
  const a = await openUniversal();
  const b = await openUniversal();
  assert.notEqual(a.cookie, b.cookie);
  const first = await request('/rsvp', 'POST', payload, a.cookie);
  const second = await request('/rsvp', 'POST', { ...payload, headcount: 5 }, b.cookie);
  assert.notEqual(first.body.data.id, second.body.data.id);
  await request('/rsvp', 'POST', { ...payload, attending: 'no', headcount: 0 }, a.cookie);
  assert.equal((await openUniversal(b.cookie)).body.data.headcount, 5);
  assert.equal(countRsvps(), 2);
});

test('清除或丢失凭证后不按姓名恢复任何回执', async () => {
  const a = await openUniversal();
  await request('/rsvp', 'POST', payload, a.cookie);
  const fresh = await openUniversal();
  assert.equal(fresh.body.data, null);
  assert.equal((await request('/rsvp', 'POST', payload)).status, 409);
  assert.equal(countRsvps(), 1);
});

test('缺失或损坏的凭证被拒绝，GET可重新准备一个有效会话', async () => {
  const invalid = 'wedding_rsvp_edit=not-a-valid-credential';
  assert.equal((await request('/rsvp', 'POST', payload, invalid)).status, 409);
  assert.equal(countRsvps(), 0);
  const fresh = await openUniversal(invalid);
  assert.notEqual(fresh.cookie, invalid);
  assert.equal(fresh.body.data, null);
});

test('重复发送首次保存请求不会新增第二条记录', async () => {
  const session = await openUniversal();
  const [a, b] = await Promise.all([request('/rsvp', 'POST', payload, session.cookie), request('/rsvp', 'POST', payload, session.cookie)]);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.equal(a.body.data.id, b.body.data.id);
  assert.equal(countRsvps(), 1);
});

test('凭证仅存摘要，不在回执响应中返回，Cookie设为HttpOnly与SameSite=Lax', async () => {
  const session = await openUniversal();
  assert.match(session.setCookie!, /HttpOnly/i);
  assert.match(session.setCookie!, /SameSite=Lax/i);
  assert.match(session.setCookie!, /Path=\/api\/invite/i);
  const token = session.cookie!.split('=')[1];
  assert.match(token, /^[a-f0-9]{64}$/);
  const saved = await request('/rsvp', 'POST', payload, session.cookie);
  const row = sqlite.prepare('SELECT edit_token_hash FROM rsvps WHERE id=?').get(saved.body.data.id) as any;
  assert.equal(row.edit_token_hash, createHash('sha256').update(token).digest('hex'));
  assert.notEqual(row.edit_token_hash, token);
  assert.equal('editTokenHash' in saved.body.data, false);
  assert.equal(JSON.stringify(saved.body).includes(token), false);
});

test('旧通用回执保留，不会因同名而被新浏览器接管', async () => {
  sqlite.prepare(`INSERT INTO rsvps (guest_name,attending,headcount,source,submitted_at,updated_at)
    VALUES ('同名回执测试','yes',7,'universal',1,1)`).run();
  const session = await openUniversal();
  assert.equal(session.body.data, null);
  await request('/rsvp', 'POST', payload, session.cookie);
  assert.equal(countRsvps(), 2);
  assert.equal((sqlite.prepare('SELECT headcount FROM rsvps WHERE submitted_at=1').get() as any).headcount, 7);
});

test('非出席回执的人数归零，提交非法值不创建或覆盖记录', async () => {
  const session = await openUniversal();
  const saved = await request('/rsvp', 'POST', { ...payload, attending: 'no', headcount: 2 }, session.cookie);
  assert.equal(saved.body.data.headcount, 0);
  assert.equal(saved.body.data.childrenCount, 0);
  for (const invalid of [null, { ...payload, attending: 'invalid' }, { ...payload, headcount: 1.5 }, { ...payload, childrenCount: 9 }]) {
    assert.equal((await request('/rsvp', 'POST', invalid, session.cookie)).status, 400);
  }
  assert.equal((await openUniversal(session.cookie)).body.data.attending, 'no');
  assert.equal(countRsvps(), 1);
});

test('原有专属链接继续覆盖自己回执，不受通用会话影响', async () => {
  addInvitedGuest();
  const first = await request('/private-invitation/rsvp', 'POST', payload);
  const second = await request('/private-invitation/rsvp', 'POST', { ...payload, headcount: 4 });
  assert.equal(first.status, 200);
  assert.equal(second.body.data.id, first.body.data.id);
  assert.equal((await request('/private-invitation')).body.data.rsvp.headcount, 4);
  assert.equal(countRsvps(), 1);
});

test('新增凭证字段的迁移保留旧宾客、回执与关联，不给历史记录分配修改凭证', () => {
  const legacy = new Database(':memory:');
  try {
    legacy.exec(readFileSync('server/db/migrations/0000_deep_bucky.sql', 'utf8'));
    legacy.prepare(`INSERT INTO guests (id,name,invite_token,created_at,updated_at) VALUES (1,'历史宾客','old-token',1,1)`).run();
    legacy.prepare(`INSERT INTO rsvps (guest_id,guest_name,attending,headcount,source,submitted_at,updated_at)
      VALUES (1,'历史宾客','yes',3,'link',1,1)`).run();
    const next = readdirSync('server/db/migrations').find((file) => file.startsWith('0001_') && file.endsWith('.sql'));
    assert.ok(next);
    legacy.exec(readFileSync(join('server/db/migrations', next), 'utf8'));
    const row = legacy.prepare('SELECT * FROM rsvps').get() as any;
    assert.equal(row.guest_id, 1);
    assert.equal(row.headcount, 3);
    assert.equal(row.edit_token_hash, null);
    assert.equal((legacy.prepare('SELECT invite_token FROM guests').get() as any).invite_token, 'old-token');
  } finally { legacy.close(); }
});
