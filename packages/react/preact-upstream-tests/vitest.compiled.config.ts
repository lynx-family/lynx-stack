// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';

import { defineConfig, mergeConfig } from 'vitest/config';
import type { Plugin } from 'vitest/config';

import { __dirname, createBaseConfig } from './vitest.shared.js';
import { transformReactLynxPlugin } from '../testing-library/src/transformReactLynxPlugin.js';

// Strip classic JSX pragmas (/** @jsx createElement */) that conflict with
// the SWC transform's automatic runtime mode. The pragma is only needed for
// esbuild in no-compiler mode; the SWC transform handles JSX itself.
function stripJsxPragmaPlugin(): Plugin {
  return {
    name: 'strip-jsx-pragma',
    enforce: 'pre',
    transform(sourceText: string, sourcePath: string) {
      if (!sourcePath.endsWith('.js') && !sourcePath.endsWith('.jsx')) return null;
      if (sourcePath.includes('node_modules')) return null;
      const stripped = sourceText.replace(/\/\*\*\s*@jsx\s+\w+\s*\*\//g, '');
      if (stripped !== sourceText) return { code: stripped, map: null };
      return null;
    },
  };
}

const baseConfig = createBaseConfig('preact-upstream-compiled');

// Compiled mode: SWC transforms JSX into snapshot elements with values arrays.
// Preact sees { values: ['foo'] } instead of raw props.
// The same tests should produce the same DOM output as no-compiler mode —
// any discrepancy indicates a bug in the compiler or runtime.
export default defineConfig(mergeConfig(baseConfig, {
  plugins: [
    stripJsxPragmaPlugin(),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    transformReactLynxPlugin({
      runtimePkgName: '@lynx-js/react',
      rootDir: __dirname,
    }) as Plugin,
  ],
  resolve: {
    alias: [
      // Compiler-generated imports: import * as ReactLynx from "@lynx-js/react/internal"
      {
        find: /^@lynx-js\/react\/internal$/,
        replacement: path.resolve(__dirname, '../runtime/lib/internal.js'),
      },
      // Compiler-generated JSX runtime: import { jsx } from "@lynx-js/react/jsx-runtime"
      {
        find: /^@lynx-js\/react\/jsx-runtime$/,
        replacement: path.resolve(__dirname, '../runtime/jsx-runtime/index.js'),
      },
      {
        find: /^@lynx-js\/react$/,
        replacement: path.resolve(__dirname, '../runtime/lib/index.js'),
      },
    ],
  },
}));
