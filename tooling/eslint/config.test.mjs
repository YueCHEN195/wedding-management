import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const root = fileURLToPath(new URL('../../', import.meta.url));
const eslint = new ESLint({ cwd: root });

async function messages(code, filePath) {
  const [result] = await eslint.lintText(code, { filePath });
  assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
  return result.messages;
}

test('pure guest views reject runtime API imports but allow DTO type imports', async () => {
  const invalid = await messages(
    "import { api } from '@/api/client'; export const load = api.guests.list;",
    'web/src/admin/guests/GuestDetails.tsx',
  );
  assert.ok(
    invalid.some((message) => message.ruleId === 'no-restricted-imports' && message.severity === 2),
  );
  const valid = await messages(
    "import type { GuestDTO } from '@shared/types'; export type Guest = GuestDTO;",
    'web/src/admin/guests/GuestDetails.tsx',
  );
  assert.equal(valid.filter((message) => message.severity === 2).length, 0);
});

test('frontend cannot import backend implementation; shared cannot import UI', async () => {
  for (const [filePath, code] of [
    [
      'web/src/admin/GuestsPage.tsx',
      "import x from '../../../server/services/guests'; export { x };",
    ],
    ['shared/wedding.ts', "import { Button } from 'antd'; export { Button };"],
  ]) {
    const result = await messages(code, filePath);
    assert.ok(
      result.some(
        (message) => message.ruleId === 'no-restricted-imports' && message.severity === 2,
      ),
    );
  }
});

test('conditional Hooks and unhandled pilot Promises block lint', async () => {
  const hooks = await messages(
    "import { useState } from 'react'; export function Example({ visible }: { visible: boolean }) { if (visible) useState(0); return null; }",
    'web/src/admin/GuestsPage.tsx',
  );
  assert.ok(
    hooks.some(
      (message) => message.ruleId === 'react-hooks/rules-of-hooks' && message.severity === 2,
    ),
  );
  const promise = await messages(
    'Promise.resolve(1);',
    'web/src/admin/guests/useGuestManagement.ts',
  );
  assert.ok(
    promise.some(
      (message) =>
        message.ruleId === '@typescript-eslint/no-floating-promises' && message.severity === 2,
    ),
  );
});
