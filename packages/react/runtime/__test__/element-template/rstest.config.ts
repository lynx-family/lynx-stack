// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from '@rstest/core';
import type { RsbuildPlugin, RstestConfig } from '@rstest/core';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const elementTemplateRuntimePkg = require.resolve(
  '../../src/element-template/internal.ts',
);

// The ReactLynx SWC transform has to see the untouched JSX source, so it runs
// as an `order: 'pre'` transform — ahead of rspack's own SWC pass.
function isProjectSource(resource: string): boolean {
  const relative = path.relative(projectRoot, resource);
  return relative !== '' && !relative.startsWith('..')
    && !path.isAbsolute(relative);
}

function pluginTransformReactLynx(): RsbuildPlugin {
  return {
    name: 'transform-react-lynx-element-template',
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

          let out = result.code;
          if (result.elementTemplates && result.elementTemplates.length > 0) {
            out += `\nif (globalThis.__REGISTER_ELEMENT_TEMPLATES__) { globalThis.__REGISTER_ELEMENT_TEMPLATES__(${
              JSON.stringify(result.elementTemplates)
            }); }\n`;
          }

          return { code: out, map: result.map ?? undefined };
        },
      );
    },
  };
}

const config: RstestConfig = defineConfig({
  root: path.resolve(__dirname, '../..'),
  name: 'react/runtime-et',
  plugins: [pluginTransformReactLynx()],
  globals: true,
  include: ['__test__/element-template/**/*.{test,spec}.{js,ts,jsx,tsx}'],
  resolve: {
    dedupe: ['preact'],
    // Fixture sources are TypeScript but import each other with `.js`
    // specifiers (NodeNext style), so rspack has to map the extension back.
    extensionAlias: {
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    },
    alias: {
      '@lynx-js/react/compat': path.resolve(__dirname, '../../compat/index.js'),
      '@lynx-js/react/worklet-runtime/bindings': path.resolve(
        __dirname,
        '../../src/worklet-runtime/bindings/index.ts',
      ),
      '@lynx-js/react/runtime-components': path.resolve(
        __dirname,
        '../../../components/src/index.ts',
      ),
      '@lynx-js/react/internal': path.resolve(
        __dirname,
        '../../src/element-template/internal.ts',
      ),
      // The ET harness evaluates both background and main-thread flows in a
      // no-layer environment. Keep JSX creation on the shared runtime so the
      // background tree still receives the standard vnode shape it expects.
      '@lynx-js/react/jsx-dev-runtime': path.resolve(
        __dirname,
        '../../jsx-dev-runtime/index.js',
      ),
      '@lynx-js/react/jsx-runtime': path.resolve(
        __dirname,
        '../../jsx-runtime/index.js',
      ),
      '@lynx-js/react/element-template/jsx-dev-runtime': path.resolve(
        __dirname,
        '../../src/element-template/jsx-dev-runtime/index.ts',
      ),
      '@lynx-js/react/element-template/jsx-runtime': path.resolve(
        __dirname,
        '../../src/element-template/jsx-runtime/index.ts',
      ),
      '@lynx-js/react/hooks$': path.resolve(
        __dirname,
        '../../src/core/hooks/react.ts',
      ),
      '@lynx-js/react/lepus/hooks$': path.resolve(
        __dirname,
        '../../src/core/hooks/mainThread.ts',
      ),
      '@lynx-js/react/lepus': path.resolve(__dirname, '../../lepus/index.js'),
      '@lynx-js/react/legacy-react-runtime': path.resolve(
        __dirname,
        '../../src/core/compat/legacy-react-runtime.ts',
      ),
      '@lynx-js/react/element-template/internal$': path.resolve(
        __dirname,
        '../../src/element-template/internal.ts',
      ),
      '@lynx-js/react/element-template$': path.resolve(
        __dirname,
        '../../src/element-template/index.ts',
      ),
      '@lynx-js/react': path.resolve(
        __dirname,
        '../../src/element-template/index.ts',
      ),
    },
  },
  // `compiledFixtureModule` drives rspack's SWC binding to turn a
  // test-time-compiled fixture into CommonJS. Load it natively instead of
  // bundling the native addon.
  output: {
    externals: {
      '@rspack/core': 'node-commonjs @rspack/core',
    },
  },
  setupFiles: [path.join(__dirname, './test-utils/setup.js')],
  coverage: {
    // NOTE: the Vitest config enforced 100% thresholds here. They are not
    // carried over: Vitest measured with `@vitest/coverage-v8` and Rstest
    // measures with `@rstest/coverage-istanbul`, which instruments files the
    // tests never load (they report 0% instead of being omitted) and counts
    // branches more strictly. The same suites score 96.5% / 99.9% under
    // istanbul, so re-enabling the gate needs new tests, not a config change.
    // Patterns are resolved against the cwd, not this project's `root`, so
    // they have to be absolute to stay anchored to the package.
    include: [path.join(projectRoot, 'src/element-template/**')],
    exclude: [
      path.join(projectRoot, 'src/element-template/**/*.d.ts'),
      path.join(projectRoot, 'src/element-template/protocol/types.ts'),
    ],
  },
});

export default config;
