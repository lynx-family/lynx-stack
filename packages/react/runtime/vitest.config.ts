import { createRequire } from 'node:module';
import * as path from 'node:path';

import type { Plugin } from 'vitest/config';
import { defineConfig } from 'vitest/config';

const require = createRequire(import.meta.url);
const runtimePkg = require.resolve('./src/internal.ts');

function transformReactLynxPlugin(): Plugin {
  return {
    name: 'transformReactLynxPlugin',
    enforce: 'pre',
    transform(sourceText, sourcePath) {
      const { transformReactLynxSync } = require(
        '@lynx-js/react-transform',
      ) as typeof import('@lynx-js/react-transform');
      const relativePath = path.basename(sourcePath);

      if (!relativePath.endsWith('.jsx') && !relativePath.endsWith('.tsx')) {
        return {
          code: sourceText,
          map: null,
        };
      }

      const result = transformReactLynxSync(sourceText, {
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
        },
        dynamicImport: false,
        // snapshot: true,
        directiveDCE: false,
        defineDCE: false,
        shake: false,
        compat: false,
        worklet: false,
        refresh: false,
        cssScope: false,
      });

      return {
        code: result.code,
        map: result.map,
      };
    },
  };
}

export default defineConfig({
  plugins: [
    transformReactLynxPlugin(),
  ],
  resolve: {
    alias: {
      '@lynx-js/react/compat': path.resolve(__dirname, './compat/index.js'),
      '@lynx-js/react/worklet-runtime/bindings': path.resolve(__dirname, './src/worklet-runtime/bindings/index.ts'),
      '@lynx-js/react/runtime-components': path.resolve(__dirname, '../components/src/index.ts'),
      '@lynx-js/react/internal': path.resolve(__dirname, './src/internal.ts'),
      '@lynx-js/react/jsx-dev-runtime': path.resolve(__dirname, './jsx-dev-runtime/index.js'),
      '@lynx-js/react/jsx-runtime': path.resolve(__dirname, './jsx-runtime/index.js'),
      '@lynx-js/react/lepus': path.resolve(__dirname, './lepus/index.js'),
      '@lynx-js/react/legacy-react-runtime': path.resolve(__dirname, './src/snapshot/legacy-react-runtime/index.ts'),
      '@lynx-js/react': path.resolve(__dirname, './src/index.ts'),
    },
  },
  test: {
    name: 'react/runtime',
    coverage: {
      exclude: [
        'debug',
        'jsx-runtime',
        'jsx-dev-runtime',
        'lepus/jsx-dev-runtime',
        'lepus/index.d.ts',
        'vitest.config.ts',
        '__test__/snapshot/utils/**',
        'lib/**',
        'worklet-runtime/**',
        'src/index.ts',
        'src/lynx.ts',
        'src/root.ts',
        'src/worklet-runtime/api/lepusQuerySelector.ts',
        'src/worklet-runtime/api/lynxApi.ts',
        'src/worklet-runtime/bindings/**',
        'src/worklet-runtime/global.ts',
        'src/worklet-runtime/index.ts',
        'src/worklet-runtime/listeners.ts',
        'src/worklet-runtime/types/**',
        'src/snapshot/debug/component-stack.ts',
        'src/snapshot/debug/debug.ts',
        'src/snapshot/debug/utils.ts',
        'src/snapshot/lynx/calledByNative.ts',
        'src/snapshot/lynx/component.ts',
        'src/snapshot/lynx/dynamic-js.ts',
        'src/snapshot/lynx/env.ts',
        'src/snapshot/lynx/tt.ts',
        'src/snapshot/compat/componentIs.ts',

        '__test__/snapshot/page.test.jsx',
        '**/*.d.ts',
        '**/*.test-d.*',
      ],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
    setupFiles: [
      path.join(__dirname, './__test__/snapshot/utils/globals.js'),
      path.join(__dirname, './__test__/snapshot/utils/setup.js'),
      path.join(__dirname, './__test__/snapshot/utils/runtimeProxy.ts'),
    ],
  },
});
