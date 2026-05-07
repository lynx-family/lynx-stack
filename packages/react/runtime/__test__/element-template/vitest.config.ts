import { createRequire } from 'node:module';
import * as path from 'node:path';

import type { Plugin, UserConfigExport } from 'vitest/config';
import { defineConfig } from 'vitest/config';

const require = createRequire(import.meta.url);
const elementTemplateRuntimePkg = require.resolve('../../src/element-template/internal.ts');
const elementTemplateHooksPkg = require.resolve('../../src/element-template/hooks/react.ts');
const layeredHooksPkg = path.resolve(__dirname, './test-utils/debug/layeredHooks.ts');

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
        elementTemplate: {
          preserveJsx: false,
          runtimePkg: elementTemplateRuntimePkg,
          jsxImportSource: '@lynx-js/react',
          filename: 'test',
          target: 'MIXED',
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
    resolveId(source, importer) {
      if (
        !importer
        || !source.startsWith('.')
        || !importer.includes(`${path.sep}src${path.sep}element-template${path.sep}`)
      ) {
        return null;
      }
      const resolved = path.resolve(path.dirname(importer), source);
      const normalized = resolved.replace(/\.(?:js|ts|jsx|tsx)$/, '');
      const hooksModule = elementTemplateHooksPkg.replace(/\.(?:js|ts|jsx|tsx)$/, '');
      return normalized === hooksModule ? layeredHooksPkg : null;
    },
  };
}

const config: UserConfigExport = defineConfig({
  plugins: [
    transformReactLynxPlugin(),
  ],
  resolve: {
    dedupe: ['preact'],
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
      '@lynx-js/react/hooks': path.resolve(
        __dirname,
        './test-utils/debug/layeredHooks.ts',
      ),
      '@lynx-js/react/lepus/hooks': path.resolve(
        __dirname,
        '../../src/core/hooks/mainThread.ts',
      ),
      '@lynx-js/react/lepus': path.resolve(__dirname, '../../lepus/index.js'),
      '@lynx-js/react/legacy-react-runtime': path.resolve(__dirname, '../../src/legacy-react-runtime/index.ts'),
      '@lynx-js/react/element-template/internal': path.resolve(__dirname, '../../src/element-template/internal.ts'),
      '@lynx-js/react': path.resolve(
        __dirname,
        './test-utils/debug/layeredReact.ts',
      ),
    },
  },
  test: {
    name: 'react/runtime-et',
    include: ['**/__test__/element-template/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    coverage: {
      include: ['src/element-template/**'],
      exclude: [
        'src/element-template/**/*.d.ts',
        // ET source tests redirect this facade to a layer-aware test shim so
        // the no-layer Vitest graph can model main-thread/background hooks.
        'src/element-template/hooks/react.ts',
        'src/element-template/protocol/types.ts',
      ],
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
