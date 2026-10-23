import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import type {
  ApiResult,
  CheckinDTO,
  GuestCandidate,
  InviteData,
  Paginated,
  PendingCheckinDTO,
  PublicCheckinResult,
  ReviewGuestRow,
  RsvpDTO,
  StatsSummary,
} from '../shared/types';

// Set the temporary database before importing any application modules.
const directory = mkdtempSync(join(tmpdir(), 'wedding-journey-test-'));
process.env.DB_PATH = join(directory, 'journey.db');
const { sqlite } = await import('../server/db/client');
const { runMigrations } = await import('../server/db/migrate');
const { createToken } = await import('../server/auth/jwt');
const { inviteRoutes } = await import('../server/routes/invite');
const { publicCheckinRoutes } = await import('../server/routes/checkin');
const { checkinRoutes } = await import('../server/routes/checkins');
const { guestRoutes } = await import('../server/routes/guests');
const { statsRoutes } = await import('../server/routes/stats');
runMigrations();
const app = new Hono()
  .route('/api/invite', inviteRoutes)
  .route('/api/checkin', publicCheckinRoutes)
  .route('/api/checkins', checkinRoutes)
  .route('/api/guests', guestRoutes)
  .route('/api/stats', statsRoutes);
const admin = `wedding_session=${await createToken({ id: 1, username: 'journey-admin', role: 'admin' })}`;
const staff = `wedding_session=${await createToken({ id: 2, username: 'journey-staff', role: 'staff' })}`;

function request(path: string, method = 'GET', body?: object, cookie?: string) {
  return app.request(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function data<T>(response: Promise<Response>): Promise<T> {
  const result = await response;
  const body = (await result.json()) as ApiResult<T>;
  assert.equal(result.status, 200, JSON.stringify(body));
  assert.equal(body.ok, true);
  if (!body.ok) throw new Error(body.error.message);
  return body.data;
}
function addGuest(token: string, group: string) {
  return Number(
    sqlite
      .prepare(
        `INSERT INTO guests(name, group_name, invite_token, created_at, updated_at)
        VALUES ('陈星满', ?, ?, 1, 1)`,
      )
      .run(group, token).lastInsertRowid,
  );
}
const reply = { attending: 'yes', headcount: 3, childrenCount: 1, message: '带孩子一起赴约' };
const attendance = { actualHeadcount: 2, actualChildrenCount: 1, amount: 0, method: 'cash' };
const summary = () => data<StatsSummary>(request('/api/stats/summary', 'GET', undefined, admin));

beforeEach(() => {
  sqlite.exec('DELETE FROM gifts; DELETE FROM checkins; DELETE FROM rsvps; DELETE FROM guests;');
});
after(() => {
  sqlite.close();
  rmSync(directory, { recursive: true, force: true });
});

test('专属回执、同名核对、仅签到及后续修改在完整流程中保持各自身份和人数口径', async () => {
  const guestId = addGuest('journey-private', '新郎同事');
  const otherId = addGuest('journey-other', '新娘同学');
  const saved = await data<RsvpDTO>(request('/api/invite/journey-private/rsvp', 'POST', reply));
  const session = await request('/api/invite/rsvp');
  const cookie = session.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  await data<RsvpDTO>(
    request('/api/invite/rsvp', 'POST', { ...reply, name: '陈星满', headcount: 5 }, cookie),
  );
  const submission = { name: '陈星满', submissionKey: randomUUID() };
  const pending = await data<PublicCheckinResult>(request('/api/checkin/self', 'POST', submission));
  const retried = await data<PublicCheckinResult>(request('/api/checkin/self', 'POST', submission));
  assert.equal(retried.id, pending.id);
  assert.equal(retried.duplicate, true);
  assert.equal((await summary()).actualHeadcount, 0);

  const queue = await data<PendingCheckinDTO[]>(
    request('/api/checkins/pending', 'GET', undefined, staff),
  );
  assert.equal(queue.length, 1);
  assert.equal(queue[0].guestId, null);
  assert.equal(queue[0].requiresGuestSelection, true);
  const candidates = await data<GuestCandidate[]>(
    request('/api/checkins/candidates?name=陈星满', 'GET', undefined, staff),
  );
  assert.equal(candidates.find((item) => item.id === guestId)?.headcount, 3);
  assert.equal(candidates.find((item) => item.id === otherId)?.headcount, null);
  const ambiguous = await request(
    `/api/checkins/${pending.id}/confirm`,
    'PATCH',
    attendance,
    staff,
  );
  assert.equal(ambiguous.status, 409);

  const confirmed = await data<CheckinDTO>(
    request(`/api/checkins/${pending.id}/confirm`, 'PATCH', { ...attendance, guestId }, staff),
  );
  assert.equal(confirmed.guestId, guestId);
  assert.equal(confirmed.actualHeadcount, 2);
  assert.equal(confirmed.giftAmount, null);
  assert.equal((await summary()).giftCount, 0);
  assert.equal((await summary()).attendingHeadcount, 8);
  assert.equal((await summary()).actualHeadcount, 2);
  assert.equal((await summary()).pendingCheckinCount, 0);
  const directory = await data<Paginated<ReviewGuestRow>>(
    request('/api/guests/workbench', 'GET', undefined, admin),
  );
  assert.equal(directory.items.find((item) => item.guestId === guestId)?.status, 'confirmed');
  assert.equal(directory.items.find((item) => item.guestId === otherId)?.status, 'unconfirmed');
  const replay = await data<PublicCheckinResult>(request('/api/checkin/self', 'POST', submission));
  assert.equal(replay.id, pending.id);
  assert.equal(replay.status, 'confirmed');

  const changed = await data<RsvpDTO>(
    request('/api/invite/journey-private/rsvp', 'POST', {
      ...reply,
      attending: 'maybe',
      headcount: 0,
      childrenCount: 0,
    }),
  );
  assert.equal(changed.id, saved.id);
  const restored = await data<InviteData>(request('/api/invite/journey-private'));
  assert.equal(restored.rsvp?.attending, 'maybe');
  assert.equal((await summary()).attendingHeadcount, 5);
  assert.equal((await summary()).actualHeadcount, 2);
});

test('散客登记、重复响应、审核及权限在同一数据库中闭环，未知实到不推算为零', async () => {
  const submission = { name: '林知夏', submissionKey: randomUUID() };
  const pending = await data<PublicCheckinResult>(request('/api/checkin/self', 'POST', submission));
  assert.equal((await request('/api/checkins/pending')).status, 401);
  assert.equal((await request('/api/stats/summary', 'GET', undefined, staff)).status, 403);
  const queue = await data<PendingCheckinDTO[]>(
    request('/api/checkins/pending', 'GET', undefined, staff),
  );
  assert.equal(queue[0].actualHeadcount, null);
  assert.equal(queue[0].actualChildrenCount, null);
  const candidates = await data<GuestCandidate[]>(
    request('/api/checkins/candidates?name=林知夏', 'GET', undefined, staff),
  );
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].headcount, null);
  await data<CheckinDTO>(
    request(
      `/api/checkins/${pending.id}/confirm`,
      'PATCH',
      {
        ...attendance,
        actualChildrenCount: 0,
        guestId: candidates[0].id,
      },
      staff,
    ),
  );
  const replay = await data<PublicCheckinResult>(request('/api/checkin/self', 'POST', submission));
  assert.equal(replay.id, pending.id);
  assert.equal(replay.status, 'confirmed');
  assert.equal(replay.duplicate, true);
  const totals = await summary();
  assert.equal(totals.guestTotal, 1);
  assert.equal(totals.checkinCount, 1);
  assert.equal(totals.actualHeadcount, 2);
  assert.equal(totals.attendingHeadcount, 0);
  assert.equal(totals.giftCount, 0);
});
