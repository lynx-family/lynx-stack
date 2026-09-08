import { createRequire } from 'node:module';
import * as path from 'node:path';

import type { Plugin, UserConfigExport } from 'vitest/config';
import { defineConfig } from 'vitest/config';

const require = createRequire(import.meta.url);
const elementTemplateRuntimePkg = require.resolve('../../src/element-template/internal.ts');
const internalPreactRoot = path.dirname(require.resolve('preact/package.json'));

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
  };
}

const config: UserConfigExport = defineConfig({
  plugins: [
    transformReactLynxPlugin(),
  ],
  resolve: {
    dedupe: ['preact'],
    alias: [
      // Pin every preact entry point to the internal-preact copy resolved from
      // this package. Without these aliases the externalized preact modules
      // resolve bare `preact` imports through pnpm's hidden hoist
      // (node_modules/.pnpm/node_modules/preact), whose winner is arbitrary
      // once another real `preact` exists anywhere in the workspace — mixing
      // two preact instances breaks hooks (`__H`) and Suspense.
      { find: /^preact$/, replacement: path.join(internalPreactRoot, 'dist/preact.mjs') },
      { find: /^preact\/compat$/, replacement: path.join(internalPreactRoot, 'compat/dist/compat.mjs') },
      { find: /^preact\/hooks$/, replacement: path.join(internalPreactRoot, 'hooks/dist/hooks.mjs') },
      {
        find: /^preact\/jsx-dev-runtime$/,
        replacement: path.join(internalPreactRoot, 'jsx-runtime/dist/jsxRuntime.mjs'),
      },
      { find: /^preact\/jsx-runtime$/, replacement: path.join(internalPreactRoot, 'jsx-runtime/dist/jsxRuntime.mjs') },
      { find: '@lynx-js/react/compat', replacement: path.resolve(__dirname, '../../compat/index.js') },
      {
        find: '@lynx-js/react/worklet-runtime/bindings',
        replacement: path.resolve(__dirname, '../../src/worklet-runtime/bindings/index.ts'),
      },
      {
        find: '@lynx-js/react/runtime-components',
        replacement: path.resolve(__dirname, '../../../components/src/index.ts'),
      },
      {
        find: '@lynx-js/react/internal',
        replacement: path.resolve(__dirname, '../../src/element-template/internal.ts'),
      },
      // The ET vitest harness evaluates both background and main-thread flows in
      // a no-layer environment. Keep JSX creation on the shared runtime so the
      // background tree still receives the standard vnode shape it expects.
      {
        find: '@lynx-js/react/jsx-dev-runtime',
        replacement: path.resolve(__dirname, '../../jsx-dev-runtime/index.js'),
      },
      { find: '@lynx-js/react/jsx-runtime', replacement: path.resolve(__dirname, '../../jsx-runtime/index.js') },
      {
        find: '@lynx-js/react/element-template/jsx-dev-runtime',
        replacement: path.resolve(__dirname, '../../src/element-template/jsx-dev-runtime/index.ts'),
      },
      {
        find: '@lynx-js/react/element-template/jsx-runtime',
        replacement: path.resolve(__dirname, '../../src/element-template/jsx-runtime/index.ts'),
      },
      { find: '@lynx-js/react/hooks', replacement: path.resolve(__dirname, '../../src/core/hooks/react.ts') },
      {
        find: '@lynx-js/react/lepus/hooks',
        replacement: path.resolve(__dirname, '../../src/core/hooks/mainThread.ts'),
      },
      { find: '@lynx-js/react/lepus', replacement: path.resolve(__dirname, '../../lepus/index.js') },
      {
        find: '@lynx-js/react/legacy-react-runtime',
        replacement: path.resolve(__dirname, '../../src/core/compat/legacy-react-runtime.ts'),
      },
      {
        find: '@lynx-js/react/element-template/internal',
        replacement: path.resolve(__dirname, '../../src/element-template/internal.ts'),
      },
      {
        find: '@lynx-js/react/element-template',
        replacement: path.resolve(__dirname, '../../src/element-template/index.ts'),
      },
      { find: '@lynx-js/react', replacement: path.resolve(__dirname, '../../src/element-template/index.ts') },
    ],
  },
  test: {
    name: 'react/runtime-et',
    server: {
      deps: {
        // Keep internal-preact inside the vite module graph so its bare
        // `preact` imports hit the aliases above instead of Node resolution
        // (which would land on pnpm's hidden hoist and may load a second
        // preact copy).
        inline: [/@lynx-js[\\/]internal-preact/],
      },
    },
    include: ['**/__test__/element-template/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    coverage: {
      include: ['src/element-template/**'],
      exclude: [
        'src/element-template/**/*.d.ts',
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
