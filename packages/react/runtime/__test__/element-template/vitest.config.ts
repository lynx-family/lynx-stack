import { createRequire } from 'node:module';
import * as path from 'node:path';

import type { Plugin, UserConfigExport } from 'vitest/config';
import { defineConfig } from 'vitest/config';

const require = createRequire(import.meta.url);
const elementTemplateRuntimePkg = require.resolve('../../src/element-template/internal.ts');

function transformReactLynxPlugin(): Plugin {
  return {
    name: 'transformReactLynxPlugin',
    enforce: 'pre',
    transform(sourceText, sourcePath, _options) {
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
          runtimePkg: elementTemplateRuntimePkg,
          jsxImportSource: '@lynx-js/react',
          filename: 'test',
          target: 'MIXED',
          experimentalEnableElementTemplate: true,
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

      let code = result.code;
      if (result.elementTemplates && result.elementTemplates.length > 0) {
        code += `\nif (globalThis.__REGISTER_ELEMENT_TEMPLATES__) { globalThis.__REGISTER_ELEMENT_TEMPLATES__(${
          JSON.stringify(result.elementTemplates)
        }); }\n`;
      }

      return {
        code,
        map: result.map ?? null,
      };
    },
  };
}

const config: UserConfigExport = defineConfig({
  plugins: [
    transformReactLynxPlugin(),
  ],
  resolve: {
    alias: {
      '@lynx-js/react/compat': path.resolve(__dirname, '../../compat/index.js'),
      '@lynx-js/react/worklet-runtime/bindings': path.resolve(
        __dirname,
        '../../src/worklet-runtime/bindings/index.ts',
      ),
      '@lynx-js/react/runtime-components': path.resolve(__dirname, '../../../components/src/index.ts'),
      '@lynx-js/react/internal': path.resolve(__dirname, '../../src/element-template/internal.ts'),
      // The ET vitest harness evaluates both background and main-thread flows in
      // a no-layer environment. Keep JSX creation on the shared runtime so the
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
      '@lynx-js/react/lepus': path.resolve(__dirname, '../../lepus/index.js'),
      '@lynx-js/react/legacy-react-runtime': path.resolve(__dirname, '../../src/legacy-react-runtime/index.ts'),
      '@lynx-js/react/element-template/internal': path.resolve(__dirname, '../../src/element-template/internal.ts'),
      '@lynx-js/react': path.resolve(__dirname, '../../src/element-template/index.ts'),
    },
  },
  test: {
    name: 'react/runtime-et',
    include: ['**/__test__/element-template/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    coverage: {
      include: ['src/element-template/**'],
      exclude: ['src/element-template/protocol/types.ts'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
    setupFiles: [
      path.join(__dirname, './test-utils/setup.js'),
    ],
  },
});

export default config;
