import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QueryClient } from '@tanstack/react-query';
import { replaceSession } from '../web/src/api/session';
import type { SessionUser } from '../shared/types';

const admin: SessionUser = { id: 1, username: 'admin', role: 'admin' };
const staff: SessionUser = { id: 2, username: 'staff', role: 'staff' };
const makeClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });

test('退出产生过401后，第一次登录就使身份检查恢复成功状态', async () => {
  const client = makeClient();
  client.setQueryData(['me'], admin);
  await assert.rejects(client.fetchQuery({
    queryKey: ['me'],
    queryFn: async () => { throw new Error('401 请先登录'); },
  }));
  assert.equal(client.getQueryState(['me'])?.status, 'error');
  // 原逻辑只标记失效，不会刷新已离开后台的身份查询。
  await client.invalidateQueries({ queryKey: ['me'] });
  assert.equal(client.getQueryState(['me'])?.status, 'error');

  await replaceSession(client, admin);
  assert.equal(client.getQueryState(['me'])?.status, 'success');
  assert.equal(client.getQueryState(['me'])?.error, null);
  assert.deepEqual(client.getQueryData(['me']), admin);
  client.clear();
});

test('切换账号时，迟到的旧身份请求不能覆盖新的登录身份', async () => {
  const client = makeClient();
  let completeOldRequest!: (user: SessionUser) => void;
  const previousResponse = new Promise<SessionUser>((resolve) => { completeOldRequest = resolve; });
  const oldRequest = client.fetchQuery({ queryKey: ['me'], queryFn: () => previousResponse }).catch(() => undefined);
  await replaceSession(client, staff);
  completeOldRequest(admin);
  await oldRequest;
  assert.deepEqual(client.getQueryData(['me']), staff);
  assert.equal(client.getQueryState(['me'])?.status, 'success');
  client.clear();
});

test('管理员切换为工作人员时，清除旧账号的礼金汇总等业务缓存', async () => {
  const client = makeClient();
  client.setQueryData(['me'], admin);
  client.setQueryData(['gifts', { page: 1 }], { summary: { total: 100000 } });
  client.setQueryData(['guest-detail', 1], { giftTotal: 100000 });
  await replaceSession(client, staff);
  assert.deepEqual(client.getQueryData(['me']), staff);
  assert.equal(client.getQueryData(['gifts', { page: 1 }]), undefined);
  assert.equal(client.getQueryData(['guest-detail', 1]), undefined);
  client.clear();
});

test('退出清除身份与业务缓存，迟到请求也不能重新填入旧数据', async () => {
  const client = makeClient();
  client.setQueryData(['me'], admin);
  let completeOldRequest!: (value: object) => void;
  const previousResponse = new Promise<object>((resolve) => { completeOldRequest = resolve; });
  const oldRequest = client.fetchQuery({ queryKey: ['stats'], queryFn: () => previousResponse }).catch(() => undefined);
  await replaceSession(client, null);
  completeOldRequest({ giftTotal: 100000 });
  await oldRequest;
  assert.equal(client.getQueryData(['me']), undefined);
  assert.equal(client.getQueryCache().getAll().length, 0);
  client.clear();
});
