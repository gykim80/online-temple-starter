import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'test/e2e/out/'] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2024, sourceType: 'module' },
    rules: {
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-control-regex': 'off', // 이름에서 제어 문자를 지우는 정규식
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  { files: ['public/**/*.js'], languageOptions: { globals: globals.browser } },
  { files: ['server/**/*.js', 'test/**/*.{js,mjs}', '*.config.js'], languageOptions: { globals: globals.node } },
  { files: ['test/e2e/**/*.mjs'], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
];
