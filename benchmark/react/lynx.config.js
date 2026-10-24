// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

import { pluginRepoFilePath } from './plugins/pluginRepoFilePath.mjs';
import { pluginScriptLoad } from './plugins/pluginScriptLoad.mjs';

const entries = {
  '001-fib': [
    'event-target-polyfill',
    './src/dummyRoot.tsx',
    './cases/001-fib/index.ts',
  ],
  '002-hello-reactLynx': [
    './src/patchProfile.ts',
    './cases/002-hello-reactLynx/index.tsx',
  ],
  '003-hello-list': [
    './src/patchProfile.ts',
    './src/patchUpdateListCallbacks.ts',
    './cases/003-hello-list/index.tsx',
  ],
  '004-various-update': [
    './cases/004-various-update/index.tsx',
  ],
  '005-load-script': [
    './cases/005-load-script/index.tsx',
  ],
  '006-static-raw-text': [
    './src/patchProfile.ts',
    './cases/006-static-raw-text/index.tsx',
  ],
  '007-four-layer-views': [
    './src/patchProfile.ts',
    './cases/007-four-layer-views/index.tsx',
  ],
  '008-many-use-state': [
    './src/patchProfile.ts',
    './cases/008-many-use-state/index.tsx',
  ],
  '009-eval-bench': [
    './cases/009-eval-bench/index.tsx',
  ],
  '010-transform-exponentiation-operator': [
    './cases/010-transform-exponentiation-operator/index.tsx',
  ],
  '011-transform-async-to-generator': [
    './cases/011-transform-async-to-generator/index.tsx',
  ],
  '012-attrs-compile': [
    './src/patchProfile.ts',
    './cases/012-attrs-compile/index.tsx',
  ],
  '013-attrs-runtime': [
    './src/patchProfile.ts',
    './cases/013-attrs-runtime/index.tsx',
  ],
  '014-attrs-mixed': [
    './src/patchProfile.ts',
    './cases/014-attrs-mixed/index.tsx',
  ],
  '015-attrs-component': [
    './src/patchProfile.ts',
    './cases/015-attrs-component/index.tsx',
  ],
  '016-use-state-local-attribute-update': [
    './cases/016-use-state-local-attribute-update/index.tsx',
  ],
  '017-use-signal-local-attribute-update': [
    './cases/017-use-signal-local-attribute-update/index.tsx',
  ],
  '018-use-state-full-attribute-update': [
    './cases/018-use-state-full-attribute-update/index.tsx',
  ],
  '019-use-signal-full-attribute-update': [
    './cases/019-use-signal-full-attribute-update/index.tsx',
  ],
  '020-many-main-thread-refs': [
    './src/patchProfile.ts',
    './cases/020-many-main-thread-refs/index.tsx',
  ],
};

export function createBenchmarkConfig(useElementTemplate = false) {
  return defineConfig({
    output: {
      distPath: { root: useElementTemplate ? 'dist/et' : 'dist' },
      filenameHash: false,
      minify: {
        js: true,
        jsOptions: {
          minimizerOptions: {
            mangle: false,
            minify: false,
          },
        },
      },
      assetPrefix: 'https://example.com/benchmark/react',
    },
    source: {
      define: {
        __BENCHMARK_ELEMENT_TEMPLATE__: JSON.stringify(useElementTemplate),
      },
      entry: useElementTemplate
        ? Object.fromEntries(
          Object.entries(entries).filter(([name]) =>
            name === '007-four-layer-views'
            || name === '018-use-state-full-attribute-update'
          ),
        )
        : entries,
    },
    plugins: [
      pluginRepoFilePath(),
      pluginReactLynx({
        experimental_useElementTemplate: useElementTemplate,
        debugInfoOutside: false,
        experimental_transformBuiltinAttributeNames: true,
      }),
      pluginScriptLoad(useElementTemplate),
      pluginQRCode({}),
    ],
    performance: {
      profile: true,
    },
  });
}

export default createBenchmarkConfig();
