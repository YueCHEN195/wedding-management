import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Hono } from 'hono';
import type {
  GiftDTO,
  GuestDTO,
  RsvpDTO,
  CheckinDTO,
  PendingCheckinDTO,
  PublicCheckinResult,
} from '../shared/types';

const directory = mkdtempSync(join(tmpdir(), 'wedding-review-safety-'));
process.env.DB_PATH = join(directory, 'test.db');
const { sqlite } = await import('../server/db/client');
const { runMigrations } = await import('../server/db/migrate');
const { createToken } = await import('../server/auth/jwt');
const { guestRoutes } = await import('../server/routes/guests');
const { giftRoutes } = await import('../server/routes/gifts');
const { rsvpRoutes } = await import('../server/routes/rsvps');
const { inviteRoutes } = await import('../server/routes/invite');
const { checkinRoutes } = await import('../server/routes/checkins');
const { publicCheckinRoutes } = await import('../server/routes/checkin');
runMigrations();
const app = new Hono()
  .route('/api/guests', guestRoutes)
  .route('/api/gifts', giftRoutes)
  .route('/api/rsvps', rsvpRoutes)
  .route('/api/invite', inviteRoutes)
  .route('/api/checkins', checkinRoutes)
  .route('/api/checkin', publicCheckinRoutes);
app.onError((_, c) => c.json({ ok: false, error: { code: 'INTERNAL' } }, 500));
const cookies = {
  admin: `wedding_session=${await createToken({ id: 1, username: 'admin', role: 'admin' })}`,
  staff: `wedding_session=${await createToken({ id: 2, username: 'staff', role: 'staff' })}`,
};
async function request<T>(
  path: string,
  method = 'GET',
  body?: object,
  role: 'admin' | 'staff' = 'admin',
  headers: Record<string, string> = {},
) {
  const response = await app.request(path, {
    method,
    headers: { Cookie: cookies[role], 'Content-Type': 'application/json', ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return {
    status: response.status,
    ...((await response.json()) as { data: T; error?: { code: string } }),
  };
}
const gift = () => ({
  submissionKey: randomUUID(),
  guestName: '同名验收',
  amount: 10000,
  method: 'cash',
});
const attendance = { actualHeadcount: 3, actualChildrenCount: 1, amount: 20000, method: 'cash' };
beforeEach(() =>
  sqlite.exec(
    'DELETE FROM operation_logs; DELETE FROM gifts; DELETE FROM checkins; DELETE FROM rsvps; DELETE FROM guests;',
  ),
);
after(() => {
  sqlite.close();
  rmSync(directory, { recursive: true, force: true });
});

test('礼金响应丢失后的并发重试只记一笔；新提交标识仍可追加相同礼金', async () => {
  const payload = gift();
  const results = await Promise.all([
    request<GiftDTO>('/api/gifts', 'POST', payload),
    request<GiftDTO>('/api/gifts', 'POST', payload),
  ]);
  assert.ok(results.every((r) => r.status === 200));
  assert.equal(results[0].data.id, results[1].data.id);
  assert.equal(sqlite.prepare('SELECT id FROM gifts').all().length, 1);
  assert.equal(sqlite.prepare("SELECT id FROM operation_logs WHERE entity='gift'").all().length, 1);
  const another = await request<GiftDTO>('/api/gifts', 'POST', {
    ...payload,
    submissionKey: randomUUID(),
  });
  assert.notEqual(another.data.id, results[0].data.id);
});

test('同一礼金提交标识不能改内容；旧客户端缺少标识不得写账；工作人员不能调用', async () => {
  const payload = gift();
  await request('/api/gifts', 'POST', payload);
  const changed = await request('/api/gifts', 'POST', { ...payload, amount: 30000 });
  assert.equal(changed.status, 409);
  assert.equal(changed.error?.code, 'IDEMPOTENCY_CONFLICT');
  assert.equal(
    (await request('/api/gifts', 'POST', { guestName: '无标识', amount: 100, method: 'cash' }))
      .status,
    400,
  );
  assert.equal((await request('/api/gifts', 'POST', gift(), 'staff')).status, 403);
  assert.equal(sqlite.prepare('SELECT id FROM gifts').all().length, 1);
});

test('记账事务失败不占用提交标识，原内容可安全重试', async () => {
  const payload = gift();
  sqlite.exec(
    "CREATE TRIGGER fail_review_gift BEFORE INSERT ON operation_logs BEGIN SELECT RAISE(ABORT,'test'); END;",
  );
  assert.equal((await request('/api/gifts', 'POST', payload)).status, 500);
  assert.equal(sqlite.prepare('SELECT id FROM gifts').all().length, 0);
  sqlite.exec('DROP TRIGGER fail_review_gift;');
  assert.equal((await request('/api/gifts', 'POST', payload)).status, 200);
});

test('待审宾客改名后仍按原ID确认，旧姓名的新档案不会接走签到及礼金', async () => {
  const original = (await request<GuestDTO>('/api/guests', 'POST', { name: '原姓名' })).data;
  const pending = (
    await request<PublicCheckinResult>('/api/checkin/self', 'POST', {
      name: '原姓名',
      submissionKey: randomUUID(),
    })
  ).data;
  assert.equal(
    (
      await request(`/api/guests/${original.id}`, 'PATCH', { name: '更正姓名' }, 'admin', {
        'If-Match': String(original.updatedAt),
      })
    ).status,
    200,
  );
  await request('/api/guests', 'POST', { name: '原姓名' });
  const queue = (await request<PendingCheckinDTO[]>('/api/checkins/pending')).data;
  assert.equal(queue[0].guestName, '更正姓名');
  assert.equal(queue[0].guestCandidates[0].id, original.id);
  const result = await request<CheckinDTO>(
    `/api/checkins/${pending.id}/confirm`,
    'PATCH',
    attendance,
  );
  assert.equal(result.status, 200);
  assert.equal(result.data.guestId, original.id);
  assert.equal(result.data.guestName, '更正姓名');
  const row = sqlite.prepare('SELECT guest_id FROM gifts').get() as { guest_id: number };
  assert.equal(row.guest_id, original.id);
  assert.equal(sqlite.prepare('SELECT id FROM guests').all().length, 2);
});

test('旧回执不能覆盖新人数；缺少版本被拒绝，专属回执更新也使旧版本失效', async () => {
  const guest = (await request<GuestDTO>('/api/guests', 'POST', { name: '回执并发' })).data;
  const path = `/api/invite/${guest.inviteToken}/rsvp`;
  const initial = (
    await request<RsvpDTO>(path, 'POST', { attending: 'yes', headcount: 2, childrenCount: 0 })
  ).data;
  const editPath = `/api/rsvps/${initial.id}`;
  const current = await request<RsvpDTO>(editPath, 'PATCH', { headcount: 5 }, 'admin', {
    'If-Match': String(initial.updatedAt),
  });
  assert.equal(current.status, 200);
  assert.ok(current.data.updatedAt > initial.updatedAt);
  assert.equal(
    (
      await request(editPath, 'PATCH', { headcount: 2, message: '旧草稿' }, 'admin', {
        'If-Match': String(initial.updatedAt),
      })
    ).status,
    409,
  );
  assert.equal((await request(editPath, 'PATCH', { headcount: 2 })).status, 409);
  assert.equal((await request<RsvpDTO>(editPath)).data.headcount, 5);
  await request(path, 'POST', { attending: 'yes', headcount: 4, childrenCount: 1 });
  assert.equal(
    (
      await request(editPath, 'PATCH', { headcount: 3 }, 'admin', {
        'If-Match': String(current.data.updatedAt),
      })
    ).status,
    409,
  );
});

test('工作人员不能读取完整回执或单条留言，但保留现场人数候选接口', async () => {
  assert.equal((await request('/api/rsvps', 'GET', undefined, 'staff')).status, 403);
  assert.equal((await request('/api/rsvps/1', 'GET', undefined, 'staff')).status, 403);
  assert.equal(
    (await request('/api/checkins/candidates?name=同名验收', 'GET', undefined, 'staff')).status,
    200,
  );
});

test('宾客档案拒绝旧版本覆盖他人更正，也拒绝缺少版本的编辑', async () => {
  const guest = (
    await request<GuestDTO>('/api/guests', 'POST', { name: '档案并发', note: '原备注' })
  ).data;
  const path = `/api/guests/${guest.id}`;
  const first = await request<GuestDTO>(path, 'PATCH', { name: '更正姓名' }, 'admin', {
    'If-Match': String(guest.updatedAt),
  });
  assert.equal(first.status, 200);
  assert.ok(first.data.updatedAt > guest.updatedAt);
  assert.equal(
    (
      await request(path, 'PATCH', { name: guest.name, note: '修改备注' }, 'admin', {
        'If-Match': String(guest.updatedAt),
      })
    ).status,
    409,
  );
  assert.equal((await request(path, 'PATCH', { note: '缺少版本' })).status, 409);
});

test('生产配置拒绝缺失、空白和默认签名密钥', () => {
  for (const key of [
    undefined,
    '',
    '  ',
    'dev-secret-change-me',
    'test-only-configured-signing-key',
  ]) {
    const childEnv = {
      ...process.env,
      NODE_ENV: 'production',
      DOTENV_CONFIG_PATH: join(directory, 'absent.env'),
    };
    delete childEnv.JWT_SECRET;
    if (key !== undefined) childEnv.JWT_SECRET = key;
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', '--input-type=module', '-e', "await import('./server/env.ts')"],
      { env: childEnv, encoding: 'utf8' },
    );
    assert.equal(result.status === 0, key === 'test-only-configured-signing-key');
  }
});
