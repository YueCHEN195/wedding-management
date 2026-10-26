import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import type {
  CheckinDTO,
  CheckinReassignmentPreview,
  GiftDTO,
  LifecyclePreview,
  StaffGuestDetailDTO,
} from '../shared/types';
const dir = mkdtempSync(join(tmpdir(), 'wedding-onsite-'));
process.env.DB_PATH = join(dir, 'test.db');
const { sqlite } = await import('../server/db/client');
const { runMigrations } = await import('../server/db/migrate');
const { createToken } = await import('../server/auth/jwt');
const { checkinRoutes } = await import('../server/routes/checkins');
const { giftRoutes } = await import('../server/routes/gifts');
const { lifecycleRoutes } = await import('../server/routes/lifecycle');
const { guestRoutes } = await import('../server/routes/guests');
const { statsRoutes } = await import('../server/routes/stats');
runMigrations();
const app = new Hono()
  .route('/api/checkins', checkinRoutes)
  .route('/api/gifts', giftRoutes)
  .route('/api/lifecycle', lifecycleRoutes)
  .route('/api/guests', guestRoutes)
  .route('/api/stats', statsRoutes);
const cookies = {
  admin: `wedding_session=${await createToken({ id: 1, username: 'admin', role: 'admin' })}`,
  staff: `wedding_session=${await createToken({ id: 2, username: 'staff', role: 'staff' })}`,
};
async function request<T = unknown>(
  path: string,
  method = 'GET',
  body?: object,
  role: 'admin' | 'staff' = 'staff',
) {
  const response = await app.request(path, {
    method,
    headers: { Cookie: cookies[role], 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return {
    status: response.status,
    ...((await response.json()) as { data: T; error?: { code: string } }),
  };
}
async function manual(name = '同名现场宾客', amount = 60000) {
  const result = await request<CheckinDTO>('/api/checkins', 'POST', {
    guestName: name,
    actualHeadcount: 2,
    actualChildrenCount: 0,
    amount,
    submissionKey: randomUUID(),
  });
  assert.equal(result.status, 200);
  const linked = sqlite.prepare('SELECT id FROM gifts WHERE checkin_id=?').get(result.data.id) as
    { id: number } | undefined;
  return { ...result.data, giftId: linked?.id ?? null };
}
function target(name = '同名现场宾客') {
  return Number(
    sqlite
      .prepare('INSERT INTO guests (name,invite_token,created_at,updated_at) VALUES (?,?,1,1)')
      .run(name, randomUUID()).lastInsertRowid,
  );
}
const gift = (id: number) =>
  sqlite
    .prepare(
      'SELECT amount,version,guest_id AS guestId,voided_at AS voidedAt FROM gifts WHERE id=?',
    )
    .get(id) as { amount: number; version: number; guestId: number; voidedAt: number | null };
async function lifecycle(entity: string, id: number, action: string) {
  const preview = await request<LifecyclePreview>(
    `/api/lifecycle/${entity}/${id}/preview?action=${action}`,
  );
  assert.equal(preview.status, 200);
  return request(`/api/lifecycle/${entity}/${id}`, 'POST', {
    action,
    token: preview.data.token,
    reason: '现场核对后处理',
  });
}
const rebindPreview = (id: number, guestId: number) =>
  request<CheckinReassignmentPreview>(`/api/checkins/${id}/reassignment?guestId=${guestId}`);
const rebind = (id: number, guestId: number, token: string) =>
  request(`/api/checkins/${id}/reassignment`, 'PATCH', { guestId, token, reason: '同名档案选错' });
beforeEach(() =>
  sqlite.exec(
    'DELETE FROM operation_logs; DELETE FROM checkin_submissions; DELETE FROM gifts; DELETE FROM checkins; DELETE FROM rsvps; DELETE FROM guests;',
  ),
);
after(() => {
  sqlite.close();
  rmSync(dir, { recursive: true, force: true });
});

test('staff更正人数保留原值、原因、操作人，未知值及过时请求不被覆盖', async () => {
  const record = await manual();
  sqlite
    .prepare('UPDATE checkins SET actual_headcount=NULL, actual_children_count=NULL WHERE id=?')
    .run(record.id);
  const body = {
    actualHeadcount: 4,
    actualChildrenCount: 1,
    expectedHeadcount: null,
    expectedChildrenCount: null,
    reason: '同行家人晚到',
  };
  assert.equal(
    (await request(`/api/checkins/${record.id}/attendance`, 'PATCH', { ...body, reason: '' }))
      .status,
    400,
  );
  assert.equal(
    (
      await request(`/api/checkins/${record.id}/attendance`, 'PATCH', {
        ...body,
        actualChildrenCount: 5,
      })
    ).status,
    400,
  );
  assert.equal((await request(`/api/checkins/${record.id}/attendance`, 'PATCH', body)).status, 200);
  assert.equal((await request(`/api/checkins/${record.id}/attendance`, 'PATCH', body)).status, 409);
  const log = sqlite
    .prepare(
      "SELECT actor_role AS role,before_json AS old FROM operation_logs WHERE action='attendance'",
    )
    .get() as { role: string; old: string };
  assert.equal(log.role, 'staff');
  assert.equal(JSON.parse(log.old).actualHeadcount, null);
  sqlite.prepare('UPDATE checkins SET actual_children_count=NULL WHERE id=?').run(record.id);
  const preview = await request<LifecyclePreview>(
    `/api/lifecycle/checkin/${record.id}/preview?action=cancel`,
  );
  assert.match(preview.data.effect, /儿童人数未记录/);
  assert.doesNotMatch(preview.data.effect, /儿童0人/);
});

test('staff签到后补礼金幂等、分笔独立，关联变化和独立建账被拒绝', async () => {
  const record = await manual();
  const body = {
    guestName: record.guestName,
    guestId: record.guestId,
    amount: 20000,
    method: 'wechat',
    submissionKey: randomUUID(),
  };
  const first = await request<GiftDTO>(`/api/checkins/${record.id}/gifts`, 'POST', body);
  assert.equal(first.status, 200);
  assert.equal(
    (await request<GiftDTO>(`/api/checkins/${record.id}/gifts`, 'POST', body)).data.id,
    first.data.id,
  );
  assert.equal(
    (await request(`/api/checkins/${record.id}/gifts`, 'POST', { ...body, amount: 1 })).status,
    409,
  );
  assert.equal(
    (
      await request(`/api/checkins/${record.id}/gifts`, 'POST', {
        ...body,
        submissionKey: randomUUID(),
        guestId: target(),
      })
    ).status,
    409,
  );
  assert.equal((await request('/api/gifts', 'POST', body)).status, 403);
  assert.equal(
    (
      await request(`/api/checkins/${record.id}/gifts`, 'POST', {
        ...body,
        submissionKey: randomUUID(),
      })
    ).status,
    200,
  );
  assert.equal((sqlite.prepare('SELECT count(*) AS n FROM gifts').get() as { n: number }).n, 3);
  const listed = await request<{ items: CheckinDTO[] }>('/api/checkins');
  assert.equal(listed.data.items[0].giftAmount, 100000);
  assert.equal(listed.data.items[0].giftCount, 3);
  assert.equal(listed.data.items[0].giftActiveCount, 3);
  await lifecycle('checkin', record.id, 'cancel');
  assert.equal(
    (
      await request(`/api/checkins/${record.id}/gifts`, 'POST', {
        ...body,
        submissionKey: randomUUID(),
      })
    ).status,
    409,
  );
});

test('staff可更正现场礼金金额和方式，版本冲突、作废记录和独立礼金受保护', async () => {
  const record = await manual();
  const id = record.giftId!;
  const body = {
    amount: 80000,
    method: 'alipay',
    expectedVersion: 1,
    reason: '金额及收款方式录错',
  };
  assert.equal((await request(`/api/gifts/${id}`, 'PATCH', body)).status, 200);
  assert.equal(gift(id).amount, 80000);
  assert.equal((await request(`/api/gifts/${id}`, 'PATCH', body)).status, 409);
  assert.equal(
    (
      await request(`/api/gifts/${id}`, 'PATCH', {
        expectedVersion: 2,
        reason: '非法改绑',
        guestId: target(),
      })
    ).status,
    400,
  );
  await lifecycle('gift', id, 'void');
  assert.equal(
    (await request(`/api/gifts/${id}`, 'PATCH', { ...body, expectedVersion: 3 })).status,
    409,
  );
  const independent = await request<GiftDTO>(
    '/api/gifts',
    'POST',
    { guestName: '独立礼金', amount: 1, submissionKey: randomUUID() },
    'admin',
  );
  assert.equal((await request(`/api/gifts/${independent.data.id}`, 'PATCH', body)).status, 403);
  assert.equal(
    (await request(`/api/lifecycle/gift/${independent.data.id}/preview?action=void`)).status,
    403,
  );
  assert.equal((await request(`/api/lifecycle/gift/${independent.data.id}/history`)).status, 403);
});

test('staff撤销签到不作废礼金，可恢复；恢复撞上新签到时拒绝，不重复计数', async () => {
  const record = await manual();
  assert.equal((await lifecycle('checkin', record.id, 'cancel')).status, 200);
  assert.equal(gift(record.giftId!).voidedAt, null);
  assert.equal((await lifecycle('checkin', record.id, 'restore')).status, 200);
  await lifecycle('checkin', record.id, 'cancel');
  await manual(record.guestName, 0);
  assert.equal(
    (await request(`/api/lifecycle/checkin/${record.id}/preview?action=restore`)).status,
    409,
  );
  assert.equal((await lifecycle('gift', record.giftId!, 'void')).status, 200);
  assert.equal((await lifecycle('gift', record.giftId!, 'restore')).status, 200);
  assert.equal((await request(`/api/stats/summary`)).status, 403);
  assert.equal(
    (await request(`/api/lifecycle/guest/${record.guestId}/preview?action=archive`)).status,
    403,
  );
});

test('staff纠正同名关联，签到及全部关联礼金原子迁移，独立礼金和回执留在原档案', async () => {
  const record = await manual();
  const guestId = target();
  await lifecycle('gift', record.giftId!, 'void');
  const extra = await request<GiftDTO>(`/api/checkins/${record.id}/gifts`, 'POST', {
    guestName: record.guestName,
    guestId: record.guestId,
    amount: 10000,
    submissionKey: randomUUID(),
  });
  const independent = await request<GiftDTO>(
    '/api/gifts',
    'POST',
    {
      guestName: record.guestName,
      guestId: record.guestId,
      amount: 1,
      submissionKey: randomUUID(),
    },
    'admin',
  );
  sqlite
    .prepare(
      "INSERT INTO rsvps (guest_id,guest_name,attending,headcount,children_count,submitted_at,updated_at) VALUES (?,?,'yes',2,0,1,1)",
    )
    .run(record.guestId, record.guestName);
  const before = gift(record.giftId!);
  const preview = await rebindPreview(record.id, guestId);
  assert.equal(preview.status, 200);
  assert.equal(preview.data.gifts.length, 2);
  assert.equal((await rebind(record.id, guestId, preview.data.token)).status, 200);
  assert.equal(gift(record.giftId!).guestId, guestId);
  assert.equal(gift(record.giftId!).voidedAt, before.voidedAt);
  assert.equal(gift(record.giftId!).version, before.version + 1);
  assert.equal(gift(extra.data.id).guestId, guestId);
  assert.equal(gift(independent.data.id).guestId, record.guestId);
  assert.equal(
    (sqlite.prepare('SELECT guest_id AS id FROM rsvps').get() as { id: number }).id,
    record.guestId,
  );
  assert.equal((await rebind(record.id, guestId, preview.data.token)).status, 409);
  const history = await request<{ detail: string }[]>(
    `/api/lifecycle/checkin/${record.id}/history`,
  );
  assert.match(history.data[0].detail, /→/);
});

test('纠正关联拒绝归档、同档案、已签到、待审目标及过时礼金预览', async () => {
  const record = await manual();
  assert.equal((await rebindPreview(record.id, record.guestId!)).status, 409);
  const targetId = target('其他宾客');
  const preview = await rebindPreview(record.id, targetId);
  await request(`/api/gifts/${record.giftId}`, 'PATCH', {
    amount: 1,
    expectedVersion: 1,
    reason: '并发修改',
  });
  assert.equal((await rebind(record.id, targetId, preview.data.token)).status, 409);
  sqlite.prepare('UPDATE guests SET archived_at=1 WHERE id=?').run(targetId);
  assert.equal((await rebindPreview(record.id, targetId)).status, 409);
  sqlite.prepare('UPDATE guests SET archived_at=NULL WHERE id=?').run(targetId);
  sqlite
    .prepare(
      "INSERT INTO checkins (guest_id,guest_name,status,submitted_at) VALUES (?,'其他宾客','pending',1)",
    )
    .run(targetId);
  assert.equal((await rebindPreview(record.id, targetId)).status, 409);
  sqlite.prepare("UPDATE checkins SET status='confirmed' WHERE guest_id=?").run(targetId);
  assert.equal((await rebindPreview(record.id, targetId)).status, 409);
  assert.equal(
    (
      await request(`/api/checkins/${record.id}/reassignment`, 'PATCH', {
        guestId: targetId,
        reason: ' ',
        token: 'bad',
      })
    ).status,
    400,
  );
  assert.equal(
    (await app.request(`/api/checkins/${record.id}/reassignment?guestId=${targetId}`)).status,
    401,
  );
});

test('staff详情返回签到关联单笔白名单，不返回独立礼金、回执、私密档案或汇总', async () => {
  const record = await manual();
  sqlite
    .prepare("UPDATE guests SET phone='13800138000',note='私人信息' WHERE id=?")
    .run(record.guestId);
  const result = await request<StaffGuestDetailDTO>(`/api/guests/${record.guestId}/detail`);
  assert.equal(result.status, 200);
  assert.equal(result.data.gifts.length, 1);
  assert.deepEqual(Object.keys(result.data).sort(), ['checkins', 'gifts', 'guest']);
  assert.deepEqual(Object.keys(result.data.gifts[0]).sort(), [
    'amount',
    'checkinId',
    'guestId',
    'guestName',
    'id',
    'method',
    'note',
    'recordedAt',
    'version',
    'voidedAt',
  ]);
  assert.doesNotMatch(
    JSON.stringify(result.data),
    /13800138000|私人信息|giftTotal|inviteToken|rsvp/,
  );
});
