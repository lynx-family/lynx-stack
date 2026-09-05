// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from '@rstest/core';
import type { RsbuildPlugin } from '@rstest/core';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = __dirname;
const runtimePkg = require.resolve('./src/internal.ts');
const internalPreactRoot = path.dirname(require.resolve('preact/package.json'));

// The ReactLynx SWC transform has to see the untouched JSX source, so it runs
// as an `order: 'pre'` transform — ahead of rspack's own SWC pass.
function isProjectSource(resource: string): boolean {
  const relative = path.relative(projectRoot, resource);
  return relative !== '' && !relative.startsWith('..')
    && !path.isAbsolute(relative);
}

function pluginTransformReactLynx(): RsbuildPlugin {
  return {
    name: 'transform-react-lynx',
    setup(api) {
      api.transform(
        {
          // Rstest builds every project of a root `projects` list in one
          // Rsbuild instance, so an unscoped transform would also compile
          // OTHER projects' sources with this project's options — silently
          // changing their snapshot ids. Only touch this project's files.
          test: (resource: string) => /\.[jt]sx$/.test(resource) && isProjectSource(resource),
          order: 'pre',
        },
        ({ code, resourcePath }) => {
          const { transformReactLynxSync } = require(
            '@lynx-js/react-transform',
          ) as typeof import('@lynx-js/react-transform');
          const relativePath = path.basename(resourcePath);

          const result = transformReactLynxSync(code, {
            mode: 'test',
            pluginName: '',
            filename: relativePath,
            sourcemap: true,
            snapshot: {
              preserveJsx: false,
              runtimePkg,
              jsxImportSource: '@lynx-js/react',
              filename: 'test',
              target: 'MIXED',
              // Files named `*.legacy-slot.test.jsx` are compiled with the
              // legacy children + wrapper codegen (`compat.legacySlot`).
              legacySlot: relativePath.endsWith('.legacy-slot.test.jsx'),
            },
            dynamicImport: false,
            directiveDCE: false,
            defineDCE: false,
            shake: false,
            compat: false,
            worklet: false,
            refresh: false,
            cssScope: false,
          });

          return { code: result.code, map: result.map };
        },
      );
    },
  };
}

export default defineConfig({
  root: __dirname,
  name: 'react/runtime',
  plugins: [pluginTransformReactLynx()],
  globals: true,
  exclude: [
    '**/node_modules/**',
    '**/dist/**',
    '**/__test__/element-template/**',
  ],
  resolve: {
    dedupe: ['preact'],
    alias: {
      'preact$': path.join(internalPreactRoot, 'dist/preact.mjs'),
      'preact/compat$': path.join(internalPreactRoot, 'compat/dist/compat.mjs'),
      'preact/hooks$': path.join(internalPreactRoot, 'hooks/dist/hooks.mjs'),
      'preact/jsx-dev-runtime$': path.join(
        internalPreactRoot,
        'jsx-runtime/dist/jsxRuntime.mjs',
      ),
      'preact/jsx-runtime$': path.join(
        internalPreactRoot,
        'jsx-runtime/dist/jsxRuntime.mjs',
      ),
      '@lynx-js/react/compat': path.resolve(__dirname, './compat/index.js'),
      '@lynx-js/react/worklet-runtime/bindings': path.resolve(
        __dirname,
        './src/worklet-runtime/bindings/index.ts',
      ),
      '@lynx-js/react/runtime-components': path.resolve(
        __dirname,
        '../components/src/index.ts',
      ),
      '@lynx-js/react/element-template/internal$': path.resolve(
        __dirname,
        './src/element-template/internal.ts',
      ),
      '@lynx-js/react/element-template$': path.resolve(
        __dirname,
        './src/element-template/index.ts',
      ),
      '@lynx-js/react/internal': path.resolve(__dirname, './src/internal.ts'),
      '@lynx-js/react-signals/lepus$': path.resolve(
        __dirname,
        '../../react-signals/src/mainThread.ts',
      ),
      '@lynx-js/react/jsx-dev-runtime': path.resolve(
        __dirname,
        './jsx-dev-runtime/index.js',
      ),
      '@lynx-js/react/jsx-runtime': path.resolve(
        __dirname,
        './jsx-runtime/index.js',
      ),
      '@lynx-js/react/hooks$': path.resolve(
        __dirname,
        './src/core/hooks/react.ts',
      ),
      '@lynx-js/react/lepus/hooks$': path.resolve(
        __dirname,
        './src/core/hooks/mainThread.ts',
      ),
      '@lynx-js/react/lepus': path.resolve(__dirname, './lepus/index.js'),
      '@lynx-js/react/legacy-react-runtime': path.resolve(
        __dirname,
        './src/core/compat/legacy-react-runtime.ts',
      ),
      '@lynx-js/react': path.resolve(__dirname, './src/index.ts'),
    },
  },
  setupFiles: [
    path.join(__dirname, './__test__/snapshot/utils/globals.js'),
    path.join(__dirname, './__test__/snapshot/utils/setup.js'),
    path.join(__dirname, './__test__/snapshot/utils/runtimeProxy.ts'),
  ],
  coverage: {
    // `v8`, matching the Vitest config this replaced: the generated snapshot
    // code carries `/* v8 ignore start|stop */` markers, which istanbul does
    // not honour.
    provider: 'v8',
    thresholds: {
      lines: 100,
      functions: 100,
      branches: 100,
      statements: 100,
    },
    exclude: [
      'debug/**',
      'jsx-runtime/**',
      'jsx-dev-runtime/**',
      'lazy/element-template-import.js',
      'lepus/jsx-dev-runtime/**',
      'lepus/index.d.ts',
      'rstest.config.ts',
      '__test__/**',
      'lib/**',
      'worklet-runtime/**',
      'src/element-template/**',
      'src/core/hooks/mainThread.ts',
      'src/core/hooks/mainThreadImpl.ts',
      'src/shared/component-stack.ts',
      'src/shared/profile.ts',
      'src/index.ts',
      'src/lynx-api.ts',
      'src/lynx.ts',
      'src/root.ts',
      'src/worklet-runtime/api/lepusQuerySelector.ts',
      'src/worklet-runtime/api/lynxApi.ts',
      'src/worklet-runtime/bindings/**',
      'src/worklet-runtime/global.ts',
      'src/worklet-runtime/index.ts',
      'src/worklet-runtime/listeners.ts',
      'src/worklet-runtime/types/**',
      'src/snapshot/debug/debug.ts',
      'src/snapshot/debug/profileHooks.ts',
      'src/snapshot/debug/utils.ts',
      'src/snapshot/lynx/calledByNative.ts',
      'src/snapshot/lynx/env.ts',
      'src/snapshot/lynx/tt.ts',
      'src/snapshot/compat/componentIs.ts',
      'src/snapshot/snapshot/types.ts',
      'src/snapshot/worklet/hmr.ts',
      '**/*.d.ts',
      '**/*.test-d.*',
    ],
  },
});
