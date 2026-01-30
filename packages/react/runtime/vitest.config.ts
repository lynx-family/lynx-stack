import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Plugin } from 'vitest/config';
import { defineConfig } from 'vitest/config';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
      '@lynx-js/react/worklet-runtime/bindings': path.resolve(__dirname, '../worklet-runtime/lib/bindings/index.js'),
      '@lynx-js/react/runtime-components': path.resolve(__dirname, '../components/src/index.ts'),
      '@lynx-js/react/internal': path.resolve(__dirname, './src/internal.ts'),
      '@lynx-js/react/jsx-dev-runtime': path.resolve(__dirname, './jsx-dev-runtime/index.js'),
      '@lynx-js/react/jsx-runtime': path.resolve(__dirname, './jsx-runtime/index.js'),
      '@lynx-js/react/lepus': path.resolve(__dirname, './lepus/index.js'),
      '@lynx-js/react/legacy-react-runtime': path.resolve(__dirname, './src/legacy-react-runtime/index.ts'),
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
        '__test__/utils/**',
        'lib/**',
        'src/index.ts',
        'src/lynx.ts',
        'src/root.ts',
        'src/debug/component-stack.ts',
        'src/debug/debug.ts',
        'src/debug/utils.ts',
        'src/lynx/calledByNative.ts',
        'src/lynx/component.ts',
        'src/lynx/dynamic-js.ts',
        'src/lynx/env.ts',
        'src/lynx/tt.ts',
        'src/compat/componentIs.ts',

        '__test__/page.test.jsx',
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
      path.join(__dirname, './__test__/utils/globals.js'),
      path.join(__dirname, './__test__/utils/setup.js'),
      path.join(__dirname, './__test__/utils/runtimeProxy.ts'),
    ],
  },
});
