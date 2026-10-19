import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const tsFiles = [
  'server/**/*.ts',
  'shared/**/*.ts',
  'web/src/**/*.{ts,tsx}',
  'tests/**/*.ts',
  '*.config.ts',
];
const hookRules = Object.fromEntries(
  Object.entries(reactHooks.configs.recommended.rules).map(([rule, value]) => [
    rule,
    rule === 'react-hooks/rules-of-hooks' ? value : 'warn',
  ]),
);

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', 'data/**', 'public/**', '.playwright-mcp/**'] },
  { linterOptions: { reportUnusedDisableDirectives: 'error' } },
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  {
    files: tsFiles,
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      'no-duplicate-imports': ['error', { allowSeparateTypeImports: true }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
      'max-lines': ['warn', { max: 350, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['warn', { max: 200, skipBlankLines: true, skipComments: true }],
      complexity: ['warn', 20],
      'max-depth': ['warn', 4],
    },
  },
  {
    files: ['web/src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: root },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...hookRules,
      '@typescript-eslint/no-floating-promises': ['warn', { ignoreVoid: true }],
      '@typescript-eslint/no-misused-promises': [
        'warn',
        { checksVoidReturn: { attributes: false } },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/server/**', '@server/**'],
              message: '前端复用shared契约，不得导入服务端实现。',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['server/**/*.ts', '*.config.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [{ group: ['**/web/**', '@/admin/**'], message: '服务端不依赖前端实现。' }],
        },
      ],
    },
  },
  {
    files: ['shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/server/**',
                '**/web/**',
                '@/admin/**',
                'antd',
                'react',
                '@tanstack/react-query',
              ],
              message: 'shared保持前后端无关，不导入页面、服务端或UI框架。',
            },
          ],
        },
      ],
    },
  },
  {
    // Feature views cannot own network requests; page entries compose hooks and views.
    files: ['web/src/admin/guests/Guest*.tsx', 'web/src/**/*.view.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/api/**', '**/api/client', '@tanstack/react-query', '**/server/**'],
              allowTypeImports: true,
              message: '视图通过props接收数据和操作；请求、mutation和缓存编排放到功能Hook。',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: {
      'max-lines': 'off',
      'max-lines-per-function': 'off',
    },
  },
  { files: ['tests/**/*.ts'], languageOptions: { globals: globals.node } },
  {
    files: ['web/src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: true }],
      'react-hooks/exhaustive-deps': 'error',
    },
  },
);
