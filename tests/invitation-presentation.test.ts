import test from 'node:test';
import assert from 'node:assert/strict';
import { getMapLinks, share } from '../web/src/invite/invitationActions';
import { weddingDisplay } from '../web/src/invite/invitationFormat';
import { wedding } from '../shared/wedding';

async function withBrowser(navigatorValue: object, run: () => void | Promise<void>) {
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: navigatorValue });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { href: 'https://example.invalid/invite/private-test-token' } },
  });
  try {
    await run();
  } finally {
    if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator);
    else Reflect.deleteProperty(globalThis, 'navigator');
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
}

test('confirmed opening is formatted in the wedding timezone', () => {
  assert.equal(weddingDisplay.date, '2026.11.22');
  assert.equal(weddingDisplay.weekday, '周日');
  assert.equal(weddingDisplay.opening, '12:08');
});

test('map searches use the confirmed branch without sharing the invitation credential', async () => {
  await withBrowser({ userAgent: 'Android' }, () => {
    const links = getMapLinks();
    assert.equal(links.length, 3);
    assert.equal(new URL(links[0].href).searchParams.get('keyword'), wedding.venue.name);
    assert.equal(new URL(links[1].href).searchParams.get('region'), '长沙市');
    assert.ok(links[2].href.startsWith('geo:0,0?q='));
    for (const link of links) {
      const decoded = decodeURIComponent(link.href);
      assert.ok(decoded.includes(wedding.venue.name));
      assert.ok(!decoded.includes('private-test-token'));
      assert.ok(!decoded.includes(wedding.groomName));
      assert.ok(!decoded.includes(wedding.brideName));
    }
  });
});

test('copy fallback preserves the exact personal invitation URL', async () => {
  let copied = '';
  await withBrowser(
    {
      clipboard: {
        writeText: (text: string) => {
          copied = text;
          return Promise.resolve();
        },
      },
    },
    async () => {
      assert.equal(await share(), 'copied');
      assert.equal(copied, 'https://example.invalid/invite/private-test-token');
    },
  );
});

test('native share cancellation is silent, while a copy failure is recoverable', async () => {
  await withBrowser(
    { share: () => Promise.reject(new DOMException('Cancelled', 'AbortError')) },
    async () => {
      assert.equal(await share(), 'cancelled');
    },
  );
  await withBrowser(
    { clipboard: { writeText: () => Promise.reject(new Error('Denied')) } },
    async () => {
      assert.equal(await share(), 'failed');
    },
  );
});
