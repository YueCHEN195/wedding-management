import assert from 'node:assert/strict';
import { test } from 'node:test';
import ExcelJS from 'exceljs';
import { requestExport } from '../web/src/admin/exports/requestExport';
import { EXPORT_ITEMS, MEDIA_EXPORT_ITEMS } from '../web/src/admin/exports/exportItems';
const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const item = EXPORT_ITEMS[0];

test('物料复用附件下载，保持PNG字节、服务端预览文件名与凭证', async (t) => {
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const signal = new AbortController().signal;
  t.mock.method(globalThis, 'fetch', (url: string, options: RequestInit) => {
    assert.equal(url, '/api/checkin/display?format=table&download=1');
    assert.equal(options.credentials, 'include');
    assert.equal(options.signal, signal);
    return Promise.resolve(
      new Response(bytes, {
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('签到桌牌-预览.png')}`,
        },
      }),
    );
  });
  const result = await requestExport(MEDIA_EXPORT_ITEMS[0], signal);
  assert.equal(result.filename, '签到桌牌-预览.png');
  assert.deepEqual(new Uint8Array(await result.blob.arrayBuffer()), bytes);
});

test('物料错误响应不会作为图片下载，非法附件路径回退本地文件名', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', () =>
    Promise.resolve(
      new Response('<html>登录页</html>', { headers: { 'Content-Type': 'text/html' } }),
    ),
  );
  await assert.rejects(
    requestExport(MEDIA_EXPORT_ITEMS[0], new AbortController().signal),
    /未返回 PNG/,
  );
  fetchMock.mock.mockImplementation(() =>
    Promise.resolve(
      new Response('png', {
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': "attachment; filename*=UTF-8''..%2Fother.png",
        },
      }),
    ),
  );
  assert.equal(
    (await requestExport(MEDIA_EXPORT_ITEMS[0], new AbortController().signal)).filename,
    '签到桌牌.png',
  );
});

test('附件请求保留凭证与取消信号，中文服务端文件名和工作簿内容不变', async (t) => {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('宾客').addRows([
    ['姓名', '备注'],
    ['陈星满', '测试导出'],
  ]);
  const bytes = new Uint8Array(await workbook.xlsx.writeBuffer());
  const controller = new AbortController();
  t.mock.method(globalThis, 'fetch', (url: string, options: RequestInit) => {
    assert.equal(url, '/api/export/guests');
    assert.equal(options.credentials, 'include');
    assert.equal(options.signal, controller.signal);
    return Promise.resolve(
      new Response(bytes, {
        headers: {
          'Content-Type': MIME,
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('宾客名单.xlsx')}`,
        },
      }),
    );
  });
  const result = await requestExport(item, controller.signal);
  assert.equal(result.filename, '宾客名单.xlsx');
  assert.deepEqual(new Uint8Array(await result.blob.arrayBuffer()), bytes);
});

for (const [status, expected] of [
  [401, /重新登录/],
  [403, /没有导出权限/],
  [503, /请稍后重试/],
] as const) {
  test(`HTTP ${status} 不会被当作 Excel 附件`, async (t) => {
    t.mock.method(globalThis, 'fetch', () => Promise.resolve(new Response('错误页', { status })));
    await assert.rejects(requestExport(item, new AbortController().signal), expected);
  });
}

test('服务端 JSON 错误保留业务原因，不交给浏览器下载', async (t) => {
  t.mock.method(globalThis, 'fetch', () =>
    Promise.resolve(
      Response.json({ ok: false, error: { message: '请稍后再试，文件正在准备' } }, { status: 503 }),
    ),
  );
  await assert.rejects(requestExport(item, new AbortController().signal), /文件正在准备/);
});

test('成功状态的 HTML 与空附件也必须作为失败处理', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', () =>
    Promise.resolve(
      new Response('<html>登录页</html>', { headers: { 'Content-Type': 'text/html' } }),
    ),
  );
  await assert.rejects(requestExport(item, new AbortController().signal), /未返回 Excel/);
  fetchMock.mock.mockImplementation(() =>
    Promise.resolve(new Response(null, { headers: { 'Content-Type': MIME } })),
  );
  await assert.rejects(requestExport(item, new AbortController().signal), /文件为空/);
});

test('网络故障与正文接收中断提供可恢复错误，取消不伪装成失败', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', () =>
    Promise.reject(new TypeError('fetch failed')),
  );
  await assert.rejects(requestExport(item, new AbortController().signal), /无法连接服务器/);
  fetchMock.mock.mockImplementation(() =>
    Promise.resolve(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.error(new Error('truncated'));
          },
        }),
        { headers: { 'Content-Type': MIME } },
      ),
    ),
  );
  await assert.rejects(requestExport(item, new AbortController().signal), /文件接收中断/);
  const controller = new AbortController();
  controller.abort();
  fetchMock.mock.mockImplementation(() =>
    Promise.reject(new DOMException('aborted', 'AbortError')),
  );
  await assert.rejects(requestExport(item, controller.signal), { name: 'AbortError' });
});

test('缺失、非法编码或路径文件名使用本类型的原文件名', async (t) => {
  for (const disposition of [
    null,
    "attachment; filename*=UTF-8''%xx",
    "attachment; filename*=UTF-8''..%2Fother.xlsx",
  ]) {
    t.mock.method(globalThis, 'fetch', () =>
      Promise.resolve(
        new Response('test', {
          headers: {
            'Content-Type': MIME,
            ...(disposition ? { 'Content-Disposition': disposition } : {}),
          },
        }),
      ),
    );
    assert.equal((await requestExport(item, new AbortController().signal)).filename, item.filename);
  }
});
