import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Hono } from 'hono';
import { eventRoutes } from '../server/routes/events';
import { notifyBusinessWrites, subscribeChanges } from '../server/services/realtime';
import { createToken } from '../server/auth/jwt';

const app = new Hono();
app.use('/api/*', notifyBusinessWrites);
app.route('/api/events', eventRoutes);
app.post('/api/example', (c) => c.json({ ok: true }));
app.post('/api/failure', (c) => c.json({ ok: false }, 409));
app.post('/api/auth/login', (c) => c.json({ ok: true }));
app.get('/api/example', (c) => c.json({ ok: true }));

test('实时订阅拒绝未登录，仅成功业务写入发布变更', async () => {
  assert.equal((await app.request('/api/events')).status, 401);
  let changes = 0;
  const unsubscribe = subscribeChanges(() => {
    changes++;
  });
  try {
    await app.request('/api/example');
    await app.request('/api/failure', { method: 'POST' });
    await app.request('/api/auth/login', { method: 'POST' });
    assert.equal(changes, 0);
    await app.request('/api/example', { method: 'POST' });
    assert.equal(changes, 1);
  } finally {
    unsubscribe();
  }
  await app.request('/api/example', { method: 'POST' });
  assert.equal(changes, 1);
});

test('管理员与工作人员均可接收无私有数据的实时通知，并可断开后重新订阅', async () => {
  for (const role of ['admin', 'staff'] as const) {
    const cookie = `wedding_session=${await createToken({ id: 1, username: '测试', role })}`;
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await app.request('/api/events', { headers: { Cookie: cookie } });
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type') ?? '', /text\/event-stream/);
      assert.equal(response.headers.get('x-accel-buffering'), 'no');
      const reader = response.body!.getReader();
      try {
        const ready = new TextDecoder().decode((await reader.read()).value);
        assert.match(ready, /event: ready/);
        await app.request('/api/example', { method: 'POST' });
        const event = new TextDecoder().decode((await reader.read()).value);
        assert.equal(event, 'event: change\ndata: {}\n\n');
      } finally {
        await reader.cancel();
      }
    }
  }
});
