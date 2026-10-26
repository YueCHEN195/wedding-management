/**
 * 开发环境并行启动器
 * 同时运行后端（tsx watch）与前端（vite），统一加前缀输出，并在其一退出时清理进程树。
 * 说明：不使用 concurrently —— 它在 Windows 下无法正常拉起 tsx watch。
 */
import { spawn, spawnSync } from 'node:child_process';

const isWin = process.platform === 'win32';
const preview = process.argv.includes('--preview')
  ? await (await import('./local-preview.mjs')).prepareLocalPreview()
  : null;

const specs = [
  { name: 'server', color: 34, command: 'tsx', args: ['watch', 'server/index.ts'] },
  { name: 'web', color: 35, command: 'vite', args: preview?.webArgs ?? [] },
];

const children = [];
let shuttingDown = false;

function killTree(child) {
  if (!child.pid) return;
  if (isWin) {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      try {
        child.kill('SIGTERM');
      } catch {
        /* ignore */
      }
    }
  }
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) killTree(c);
  process.exit(code ?? 0);
}

for (const spec of specs) {
  const child = spawn(`${spec.command} ${spec.args.join(' ')}`, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
    windowsHide: true,
    detached: !isWin,
    env: preview?.env ?? process.env,
  });

  const tag = `\x1b[${spec.color}m[${spec.name}]\x1b[0m`;
  const pipe = (stream) =>
    stream.on('data', (chunk) => {
      const text = String(chunk).replace(/\r?\n$/, '');
      for (const line of text.split(/\r?\n/)) process.stdout.write(`${tag} ${line}\n`);
    });
  pipe(child.stdout);
  pipe(child.stderr);

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.log(`${tag} 已退出（code=${code} signal=${signal}），正在停止其它进程…`);
    shutdown(code ?? 1);
  });
  child.on('error', (error) => {
    console.error(`${tag} 启动失败：${error.message}`);
    shutdown(1);
  });

  children.push(child);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

if (preview) {
  void preview.showEntrances().catch((error) => {
    console.error(error.message);
    shutdown(1);
  });
}
