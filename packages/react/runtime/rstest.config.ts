import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from '@rstest/core';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runtimePkg = require.resolve('./src/internal.ts');

// Force a single preact instance. react/runtime's `src` imports the bundled
// internal-preact; jsdom + the `.mjs` ESM build are required so preact's hook
// dispatcher (`__H`) is shared across the runtime and the tests. Under the
// `node` environment the `.mjs` alias is bypassed and a second preact copy
// leaks in, so `testEnvironment: 'jsdom'` is REQUIRED below.
const reactRequire = createRequire(require.resolve('@lynx-js/react/package.json'));
const preactSingletonAlias = Object.fromEntries(
  ['preact', 'preact/hooks', 'preact/compat', 'preact/jsx-runtime'].map(
    (s) => [`${s}$`, reactRequire.resolve(s).replace(/\.js$/, '.mjs')],
  ),
);

export default defineConfig({
  testEnvironment: 'jsdom',
  name: 'react/runtime',
  include: ['__test__/**/*.{test,spec}.{js,ts,jsx,tsx}'],
  exclude: [
    '**/node_modules/**',
    '**/dist/**',
    '**/__test__/element-template/**',
  ],
  setupFiles: [
    path.join(__dirname, './__test__/snapshot/utils/globals.js'),
    path.join(__dirname, './__test__/snapshot/utils/setup.js'),
    path.join(__dirname, './__test__/snapshot/utils/runtimeProxy.ts'),
    path.join(__dirname, './__test__/test-utils/rstest-setup.ts'),
  ],
  resolve: {
    dedupe: ['preact'],
    alias: {
      ...preactSingletonAlias,
      vitest: require.resolve('./vitest-polyfill.cjs'),
      '@lynx-js/react/compat': path.resolve(__dirname, './compat/index.js'),
      '@lynx-js/react/worklet-runtime/bindings': path.resolve(
        __dirname,
        './src/worklet-runtime/bindings/index.ts',
      ),
      '@lynx-js/react/runtime-components': path.resolve(__dirname, '../components/src/index.ts'),
      '@lynx-js/react/element-template/internal': path.resolve(__dirname, './src/element-template/internal.ts'),
      '@lynx-js/react/element-template': path.resolve(__dirname, './src/element-template/index.ts'),
      '@lynx-js/react/internal': path.resolve(__dirname, './src/internal.ts'),
      '@lynx-js/react/jsx-dev-runtime': path.resolve(__dirname, './jsx-dev-runtime/index.js'),
      '@lynx-js/react/jsx-runtime': path.resolve(__dirname, './jsx-runtime/index.js'),
      '@lynx-js/react/hooks': path.resolve(__dirname, './src/core/hooks/react.ts'),
      '@lynx-js/react/lepus/hooks': path.resolve(__dirname, './src/core/hooks/mainThread.ts'),
      '@lynx-js/react/lepus': path.resolve(__dirname, './lepus/index.js'),
      '@lynx-js/react/legacy-react-runtime': path.resolve(
        __dirname,
        './src/core/compat/legacy-react-runtime.ts',
      ),
      '@lynx-js/react': path.resolve(__dirname, './src/index.ts'),
    },
  },
  source: {
    include: [/@lynx-js[\\/]internal-preact/],
  },
  tools: {
    bundlerChain(chain) {
      chain.module
        .rule('react-lynx-transform')
        .test(/\.(jsx|tsx)$/)
        .use('react-lynx-transform-loader')
        .loader(require.resolve('./transform-loader.cjs'))
        .options({ mode: 'snapshot', runtimePkg })
        .end();
    },
  },
});
