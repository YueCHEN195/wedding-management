import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, appendFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import Database from 'better-sqlite3';
import { chromium } from '../../tooling/e2e/node_modules/playwright/index.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const artifacts = join(
  root,
  'test-results',
  'phase1',
  new Date().toISOString().replaceAll(':', '-'),
);
const temporary = mkdtempSync(join(tmpdir(), 'wedding-phase1-'));
const databasePath = join(temporary, 'acceptance.db');
let server,
  database,
  browser,
  sequence = 0;
export let origin;
const results = [];
const credentials = { admin: 'phase1-admin', staff: 'phase1-staff' };

async function availablePort() {
  const probe = createServer();
  await new Promise((done, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', done);
  });
  const port = probe.address().port;
  await new Promise((done) => probe.close(done));
  return port;
}
function startProcess(args, env, ready) {
  const child = spawn(process.execPath, args, {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return new Promise((done, reject) => {
    let output = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('测试服务启动超时'));
    }, 20000);
    const fail = (code) => {
      clearTimeout(timer);
      if (!ready && code === 0) done(child);
      else reject(new Error(`测试进程退出 ${code}: ${output.slice(-2000)}`));
    };
    child.once('error', reject);
    child.once('exit', fail);
    for (const stream of [child.stdout, child.stderr])
      stream.on('data', (chunk) => {
        output += chunk.toString();
        appendFileSync(join(artifacts, 'server.log'), chunk);
        if (ready && ready(output)) {
          clearTimeout(timer);
          child.off('exit', fail);
          done(child);
        }
      });
  });
}
before(async () => {
  assert.ok(existsSync(join(root, 'web/dist/index.html')), '先执行 pnpm build');
  mkdirSync(artifacts, { recursive: true });
  const port = await availablePort();
  origin = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    WEDDING_E2E_RUN: '1',
    DB_PATH: databasePath,
    PUBLIC_BASE_URL: origin,
    PORT: String(port),
    JWT_SECRET: randomUUID() + randomUUID(),
  };
  await startProcess(['--import', 'tsx', 'tests/e2e/seed.ts'], env);
  server = await startProcess(['--import', 'tsx', 'server/index.ts'], env, (output) =>
    output.includes('[server] listening on'),
  );
  database = new Database(databasePath);
  database.pragma('foreign_keys = ON');
  database.pragma('busy_timeout = 5000');
  browser = await chromium.launch({
    headless: true,
    ...(process.env.E2E_BROWSER_CHANNEL ? { channel: process.env.E2E_BROWSER_CHANNEL } : {}),
  });
  console.log(`独立测试应用 ${origin}；结果目录 ${artifacts}`);
});
after(async () => {
  await browser?.close();
  database?.close();
  if (server && server.exitCode == null) {
    const stopped = new Promise((done) => server.once('exit', done));
    server.kill('SIGTERM');
    const force = setTimeout(() => server.kill('SIGKILL'), 5000);
    await stopped;
    clearTimeout(force);
  }
  if (existsSync(artifacts))
    writeFileSync(join(artifacts, 'results.json'), JSON.stringify({ origin, results }, null, 2));
  rmSync(temporary, { recursive: true, force: true });
});

export function rows(sql, ...bindings) {
  return database.prepare(sql).all(...bindings);
}
export function row(sql, ...bindings) {
  return database.prepare(sql).get(...bindings);
}
export function legacy(sql, ...bindings) {
  assert.ok(database.name === databasePath && databasePath.startsWith(temporary + '/'));
  return database.prepare(sql).run(...bindings);
}
export async function context(role) {
  const ctx = await browser.newContext({
    baseURL: origin,
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
    extraHTTPHeaders: { 'X-Forwarded-For': `127.0.1.${++sequence}` },
  });
  ctx.setDefaultTimeout(12000);
  if (role)
    await api(ctx, '/api/auth/login', 'POST', {
      username: credentials[role],
      password: 'Phase1-Test-Only!',
    });
  return ctx;
}
export async function api(ctx, path, method = 'GET', data, headers) {
  const response = await ctx.request.fetch(path, {
    method,
    ...(data !== undefined ? { data } : {}),
    headers,
  });
  const body = await response.json();
  assert.equal(response.status(), 200, `${path}: ${JSON.stringify(body)}`);
  assert.equal(body.ok, true);
  return body.data;
}
export const guest = (ctx, name = '一期验收来宾', values = {}) =>
  api(ctx, '/api/guests', 'POST', { name, groupName: '验收亲友', side: 'both', ...values });
export const manual = (ctx, name, values = {}) =>
  api(ctx, '/api/checkins', 'POST', {
    guestName: name,
    actualHeadcount: 2,
    actualChildrenCount: 0,
    amount: 0,
    method: 'cash',
    submissionKey: randomUUID(),
    ...values,
  });
export const gift = (ctx, values = {}) =>
  api(ctx, '/api/gifts', 'POST', {
    guestName: '独立礼金来宾',
    amount: 60000,
    method: 'cash',
    submissionKey: randomUUID(),
    ...values,
  });
export async function capture(page, name) {
  await page.screenshot({ path: join(artifacts, `${name}.png`), animations: 'disabled' });
}
export async function openRsvp(page, path) {
  await page.goto(path);
  await page.getByRole('button', { name: /打开请柬/ }).click();
  await page.locator('.invite-open-inline').click();
  await page.locator('.rsvp-form').waitFor();
}
export async function closeDrawer(page) {
  await page
    .locator('.ant-drawer-open')
    .last()
    .getByRole('button', { name: /关\s*闭/ })
    .last()
    .click();
}
export async function noOverflow(page) {
  const geometry = await page.evaluate(() => ({
    content: globalThis.document.documentElement.scrollWidth,
    window: globalThis.innerWidth,
  }));
  assert.ok(geometry.content <= geometry.window + 1, JSON.stringify(geometry));
}
export function scenario(id, title, body) {
  test(`${id} ${title}`, { timeout: 90000 }, async () => {
    database
      .transaction(() => {
        for (const table of [
          'operation_logs',
          'checkin_submissions',
          'gifts',
          'checkins',
          'rsvps',
          'guests',
        ])
          database.prepare(`DELETE FROM ${table}`).run();
      })
      .immediate();
    const contexts = [];
    const exceptions = [];
    const create = async (role) => {
      const ctx = await context(role);
      contexts.push(ctx);
      await ctx.tracing.start({ screenshots: true, snapshots: true });
      ctx.on('page', (page) => page.on('pageerror', (error) => exceptions.push(error.message)));
      return ctx;
    };
    const start = Date.now();
    try {
      await body({ create, id });
      assert.deepEqual(exceptions, [], '浏览器存在未处理异常');
      results.push({ id, title, status: 'passed', durationMs: Date.now() - start });
    } catch (error) {
      for (const [index, ctx] of contexts.entries()) {
        for (const page of ctx.pages())
          await capture(page, `${id}-failed-${index}`).catch(() => {});
        await ctx.tracing
          .stop({ path: join(artifacts, `${id}-failed-${index}.zip`) })
          .catch(() => {});
      }
      results.push({
        id,
        title,
        status: 'failed',
        error: String(error),
        durationMs: Date.now() - start,
      });
      throw error;
    } finally {
      for (const ctx of contexts) await ctx.close();
    }
  });
}
