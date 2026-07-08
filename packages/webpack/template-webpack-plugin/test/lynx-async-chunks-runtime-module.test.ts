// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Regression: an empty `mode` map must not be emitted. rspack lowers an
// unused `__webpack_require__.lynx_acm = {}` assignment to `undefined = {}`,
// which throws in strict mode. So when no async chunk carries a `mode`, the
// module must skip the mode line entirely (ids line stays).

import { rspack } from '@rspack/core';
import { describe, expect, test } from '@rstest/core';

import { RuntimeGlobals } from '@lynx-js/webpack-runtime-globals';

import { createLynxAsyncChunksRuntimeModule } from '../src/LynxAsyncChunksRuntimeModule.js';

const LynxAsyncChunksRuntimeModule = createLynxAsyncChunksRuntimeModule(rspack);

interface FakeChunk {
  id: string | number;
  name: string;
}

interface FakeBlock {
  dependencies: Array<{ attributes?: Record<string, unknown> }>;
  blocks: FakeBlock[];
}

// Drive `generate()` with the minimal shape it reads, so the test stays a unit
// test of the emit logic (no full rspack compilation).
function generate(
  asyncChunks: FakeChunk[],
  modules: Array<{ blocks: FakeBlock[] }> = [],
  blockChunkGroup: { chunks: FakeChunk[] } | null = null,
): string {
  const mod = new LynxAsyncChunksRuntimeModule((chunkName) => chunkName);
  Object.assign(mod, {
    chunk: { getAllAsyncChunks: () => new Set(asyncChunks) },
    compilation: { modules, getPath: (filename: string) => filename },
    chunkGraph: { getBlockChunkGroup: () => blockChunkGroup },
  });
  return mod.generate();
}

describe('LynxAsyncChunksRuntimeModule', () => {
  test('emits the ids map', () => {
    const out = generate([{ id: 0, name: 'a' }]);
    expect(out).toContain(RuntimeGlobals.lynxAsyncChunkIds);
    expect(out).toContain('"a"');
  });

  test('skips the mode map when no async chunk carries a `mode`', () => {
    const out = generate([{ id: 0, name: 'a' }]);
    // No empty `${lynxAsyncChunkMode} = {}` — rspack would lower it to
    // `undefined = {}` and throw in strict mode.
    expect(out).not.toContain(RuntimeGlobals.lynxAsyncChunkMode);
    expect(out).not.toContain('async chunks modes');
  });

  test('emits the mode map when an async chunk carries a `mode`', () => {
    const chunk: FakeChunk = { id: 0, name: 'a' };
    const out = generate(
      [chunk],
      [{
        blocks: [{
          dependencies: [{ attributes: { mode: 'sync' } }],
          blocks: [],
        }],
      }],
      { chunks: [chunk] },
    );
    expect(out).toContain(RuntimeGlobals.lynxAsyncChunkMode);
    expect(out).toContain('"sync"');
  });
});
