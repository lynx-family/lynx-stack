// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, it } from 'vitest';

import { transformReactLynxSync } from '../main.js';

// Values of `defineDCE.define` are parsed once per distinct define set and
// then memoized for the rest of the process, so this name is not shared with
// any other test: another test using it would warm the cache up first.
const DEFINE = '__SOURCEMAP_STABILITY__';

function options() {
  return {
    mode: 'test',
    pluginName: '',
    filename: 'test.jsx',
    sourceFileName: 'test.jsx',
    sourcemap: true,
    cssScope: false,
    shake: false,
    compat: false,
    refresh: false,
    directiveDCE: false,
    snapshot: false,
    defineDCE: {
      define: {
        [DEFINE]: 'true',
      },
    },
    worklet: {
      target: 'JS',
      filename: 'test.jsx',
      runtimePkg: '@lynx-js/react/internal',
    },
    isModule: 'unknown',
  };
}

const source = `export const flag = ${DEFINE}\nconsole.log(flag)\n`;

describe('source map', () => {
  it('does not change when the same input is transformed twice', () => {
    const first = transformReactLynxSync(source, options());
    const second = transformReactLynxSync(source, options());

    expect(second.code).toBe(first.code);
    expect(second.map).toBe(first.map);
  });
});
