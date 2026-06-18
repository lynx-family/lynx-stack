import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from '@rstest/core';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '../..');
const elementTemplateRuntimePkg = require.resolve('../../src/element-template/internal.ts');

// Force a single preact instance, same as the main suite. See the comment in
// `rstest.config.ts` (main): `testEnvironment: 'jsdom'` is REQUIRED so the
// `.mjs` alias is honored and preact's hook dispatcher is shared.
const reactRequire = createRequire(require.resolve('@lynx-js/react/package.json'));
const preactSingletonAlias = Object.fromEntries(
  ['preact', 'preact/hooks', 'preact/compat', 'preact/jsx-runtime'].map(
    (s) => [`${s}$`, reactRequire.resolve(s).replace(/\.js$/, '.mjs')],
  ),
);

export default defineConfig({
  testEnvironment: 'jsdom',
  name: 'react/runtime-et',
  root: packageRoot,
  include: ['__test__/element-template/**/*.{test,spec}.{js,ts,jsx,tsx}'],
  setupFiles: [
    path.join(__dirname, './test-utils/setup.js'),
    path.join(packageRoot, './__test__/test-utils/rstest-setup.ts'),
  ],
  resolve: {
    dedupe: ['preact'],
    alias: {
      ...preactSingletonAlias,
      vitest: require.resolve('../../vitest-polyfill.cjs'),
      '@lynx-js/react/compat': path.resolve(__dirname, '../../compat/index.js'),
      '@lynx-js/react/worklet-runtime/bindings': path.resolve(
        __dirname,
        '../../src/worklet-runtime/bindings/index.ts',
      ),
      '@lynx-js/react/runtime-components': path.resolve(__dirname, '../../../components/src/index.ts'),
      '@lynx-js/react/internal': path.resolve(__dirname, '../../src/element-template/internal.ts'),
      // The ET harness evaluates both background and main-thread flows in a
      // no-layer environment. Keep JSX creation on the shared runtime so the
      // background tree still receives the standard vnode shape it expects.
      '@lynx-js/react/jsx-dev-runtime': path.resolve(__dirname, '../../jsx-dev-runtime/index.js'),
      '@lynx-js/react/jsx-runtime': path.resolve(__dirname, '../../jsx-runtime/index.js'),
      '@lynx-js/react/element-template/jsx-dev-runtime': path.resolve(
        __dirname,
        '../../src/element-template/jsx-dev-runtime/index.ts',
      ),
      '@lynx-js/react/element-template/jsx-runtime': path.resolve(
        __dirname,
        '../../src/element-template/jsx-runtime/index.ts',
      ),
      '@lynx-js/react/hooks': path.resolve(__dirname, '../../src/core/hooks/react.ts'),
      '@lynx-js/react/lepus/hooks': path.resolve(__dirname, '../../src/core/hooks/mainThread.ts'),
      '@lynx-js/react/lepus': path.resolve(__dirname, '../../lepus/index.js'),
      '@lynx-js/react/legacy-react-runtime': path.resolve(
        __dirname,
        '../../src/core/compat/legacy-react-runtime.ts',
      ),
      '@lynx-js/react/element-template/internal': path.resolve(__dirname, '../../src/element-template/internal.ts'),
      '@lynx-js/react/element-template': path.resolve(__dirname, '../../src/element-template/index.ts'),
      '@lynx-js/react': path.resolve(__dirname, '../../src/element-template/index.ts'),
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
        .loader(require.resolve('../../transform-loader.cjs'))
        .options({ mode: 'elementTemplate', runtimePkg: elementTemplateRuntimePkg })
        .end();
    },
  },
});
