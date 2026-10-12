// ESLint config for the extension: catches real bugs (undefined names, unreachable code, duplicate keys,
// dead code). No style rules. Run with tools/lint/run.sh.
const browser = Object.fromEntries(['window', 'document', 'navigator', 'location', 'console', 'setTimeout', 'clearTimeout', 'setInterval',
  'clearInterval', 'requestAnimationFrame', 'performance', 'URL', 'URLSearchParams', 'Blob', 'createImageBitmap', 'OffscreenCanvas',
  'CSSStyleSheet', 'IntersectionObserver', 'KeyboardEvent', 'MouseEvent', 'Event', 'Element', 'HTMLElement', 'crypto', 'atob', 'btoa', 'Intl',
  'self', 'parent', 'chrome', 'matchMedia', 'getComputedStyle', 'structuredClone', 'globalThis'].map((k) => [k, 'readonly']));
export default [{
  files: ['**/*.js'],
  languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: browser },
  rules: {
    'no-undef': 'error', 'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }], 'no-unreachable': 'error',
    'no-dupe-keys': 'error', 'no-dupe-else-if': 'error', 'no-duplicate-case': 'error', 'no-self-assign': 'error', 'no-redeclare': 'error',
    'no-shadow-restricted-names': 'error', 'no-cond-assign': 'error', 'no-constant-condition': ['error', { checkLoops: false }],
    'no-unsafe-finally': 'error', 'no-unsafe-negation': 'error', 'no-async-promise-executor': 'error', 'use-isnan': 'error',
    'valid-typeof': 'error', 'no-empty-pattern': 'error', 'no-fallthrough': 'error',
  },
}, { files: ['**/hotkey.js'], languageOptions: { sourceType: 'script' } }];
