import { networkInterfaces } from 'node:os';
import { createServer } from 'node:net';
import { setTimeout } from 'node:timers/promises';
import QRCode from 'qrcode';

function localAddress() {
  const addresses = Object.entries(networkInterfaces())
    .filter(([name]) => !/^(utun|tun|tap|docker|veth|bridge|vmnet)/i.test(name))
    .flatMap(([name, entries]) =>
      entries
        .filter((entry) => entry.family === 'IPv4' && !entry.internal)
        .map((entry) => ({ name, address: entry.address })),
    )
    .sort(
      (a, b) =>
        Number(!/^(en0|eth0|wlan0)$/.test(a.name)) - Number(!/^(en0|eth0|wlan0)$/.test(b.name)),
    );
  const override = process.env.PREVIEW_HOST;
  if (override && !addresses.some((entry) => entry.address === override)) {
    throw new Error('PREVIEW_HOST 必须是本机可用的局域网 IPv4 地址。');
  }
  const address = override ?? addresses[0]?.address;
  if (!address) throw new Error('未找到局域网地址，请连接 Wi-Fi 或有线网络后重试。');
  return { address, addresses };
}

async function availablePort(start) {
  for (let port = start; port < start + 50; port++) {
    const probe = createServer();
    const free = await new Promise((resolve, reject) => {
      probe.once('error', (error) => {
        if (error.code === 'EADDRINUSE') resolve(false);
        else reject(error);
      });
      probe.listen(port, '0.0.0.0', () => probe.close(() => resolve(true)));
    });
    if (free) return port;
  }
  throw new Error(`端口 ${start} 起连续50个端口均被占用，请关闭旧服务后重试。`);
}

export async function prepareLocalPreview() {
  const { address, addresses } = localAddress();
  const apiPort = await availablePort(3000);
  const webPort = await availablePort(5173);
  const baseUrl = `http://${address}:${webPort}`;
  return {
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(apiPort),
      PUBLIC_BASE_URL: baseUrl,
      DEV_API_TARGET: `http://127.0.0.1:${apiPort}`,
    },
    webArgs: [
      '--host',
      '0.0.0.0',
      '--port',
      String(webPort),
      '--strictPort',
      '--mode',
      'local-preview',
    ],
    async showEntrances() {
      // Check the API through Vite, so a working frontend alone cannot produce a false ready message.
      const deadline = Date.now() + 60_000;
      let ready = false;
      while (Date.now() < deadline && !ready) {
        try {
          // Wait for the backend first to avoid noisy proxy errors during migrations.
          const backend = await fetch(`http://127.0.0.1:${apiPort}/api/health`, {
            signal: AbortSignal.timeout(1000),
          });
          if (!backend.ok || (await backend.json()).data?.status !== 'ok') {
            await setTimeout(300);
            continue;
          }
          const response = await fetch(`http://127.0.0.1:${webPort}/api/health`, {
            signal: AbortSignal.timeout(1000),
          });
          ready = response.ok && (await response.json()).data?.status === 'ok';
        } catch {
          // Both child servers may still be starting.
        }
        if (!ready) await setTimeout(300);
      }
      if (!ready) throw new Error('本地预览启动超时，请检查上方前后端错误信息。');
      console.log('\n本地预览已就绪 · 手机与电脑连接同一 Wi-Fi，微信扫一扫下方二维码。');
      console.log('使用当前开发数据库；不会自动清空或填充示例数据。Ctrl+C 同时停止前后端。');
      if (addresses.length > 1) {
        console.log(
          `检测到多个网卡，当前使用 ${address}；如手机无法连接，可用 PREVIEW_HOST 指定：`,
        );
        console.log(addresses.map((entry) => `${entry.name}: ${entry.address}`).join('，'));
      }
      for (const [name, path] of [
        ['请柬', '/invite'],
        ['签到', '/checkin'],
      ]) {
        const url = `${baseUrl}${path}`;
        console.log(`\n${name}：${url}`);
        console.log(await QRCode.toString(url, { type: 'terminal', small: true }));
      }
      console.log(`管理后台：${baseUrl}/admin\n`);
    },
  };
}
