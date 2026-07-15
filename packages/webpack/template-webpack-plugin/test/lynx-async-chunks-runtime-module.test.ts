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

interface FakeDependency {
  attributes?: Record<string, unknown>;
  request?: string;
}

interface FakeBlock {
  dependencies: FakeDependency[];
  blocks: FakeBlock[];
}

interface FakeModule {
  blocks: FakeBlock[];
  readableIdentifier?: () => string;
}

// Drive `generate()` with the minimal shape it reads, so the test stays a unit
// test of the emit logic (no full rspack compilation). Returns the emitted
// source plus any errors the module pushed onto the compilation.
function run(
  asyncChunks: FakeChunk[],
  modules: FakeModule[] = [],
  blockChunkGroup: { chunks: FakeChunk[] } | null = null,
): { out: string; errors: Error[] } {
  const mod = new LynxAsyncChunksRuntimeModule((chunkName) => chunkName);
  const errors: Error[] = [];
  Object.assign(mod, {
    chunk: { getAllAsyncChunks: () => new Set(asyncChunks) },
    compilation: {
      modules,
      errors,
      requestShortener: undefined,
      getPath: (filename: string) => filename,
    },
    chunkGraph: { getBlockChunkGroup: () => blockChunkGroup },
  });
  return { out: mod.generate(), errors };
}

function generate(
  asyncChunks: FakeChunk[],
  modules: FakeModule[] = [],
  blockChunkGroup: { chunks: FakeChunk[] } | null = null,
): string {
  return run(asyncChunks, modules, blockChunkGroup).out;
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

  test('keeps a single mode when every import site agrees', () => {
    const chunk: FakeChunk = { id: 0, name: 'a' };
    const { out, errors } = run(
      [chunk],
      [
        {
          blocks: [{
            dependencies: [{ attributes: { mode: 'sync' } }],
            blocks: [],
          }],
        },
        {
          blocks: [{
            dependencies: [{ attributes: { mode: 'sync' } }],
            blocks: [],
          }],
        },
      ],
      { chunks: [chunk] },
    );
    expect(errors).toHaveLength(0);
    expect(out).toContain('"sync"');
  });

  test('reports one conflict per request and falls back to async when a bundle is both sync and async', () => {
    // Both threads of the same component (main-thread + background) map to the
    // same import request, so a single conflict is reported — not one per chunk.
    const mainThread: FakeChunk = { id: 0, name: 'foo__main-thread' };
    const background: FakeChunk = { id: 1, name: 'foo__background' };
    const { out, errors } = run(
      [mainThread, background],
      [
        {
          readableIdentifier: () => 'src/host/first-screen.tsx',
          blocks: [{
            dependencies: [{
              attributes: { mode: 'sync' },
              request: './LazyFoo.js',
            }],
            blocks: [],
          }],
        },
        {
          readableIdentifier: () => 'src/host/lazy.tsx',
          blocks: [{
            dependencies: [{
              attributes: { mode: 'async' },
              request: './LazyFoo.js',
            }],
            blocks: [],
          }],
        },
      ],
      { chunks: [mainThread, background] },
    );
    // One error (grouped by request), naming the bundle, both modes, and each
    // importing module. Both chunks' mode entries are dropped so the runtime
    // uses its non-blocking async default.
    expect(errors).toHaveLength(1);
    const message = errors[0]!.message;
    expect(message).toContain('./LazyFoo.js');
    expect(message).toContain('\'sync\'');
    expect(message).toContain('\'async\'');
    expect(message).toContain('src/host/first-screen.tsx');
    expect(message).toContain('src/host/lazy.tsx');
    expect(out).not.toContain(RuntimeGlobals.lynxAsyncChunkMode);
  });

  test('does not merge distinct requests into one conflict', () => {
    const chunkA: FakeChunk = { id: 0, name: 'a' };
    const { errors } = run(
      [chunkA],
      [
        {
          blocks: [{
            dependencies: [{ attributes: { mode: 'sync' }, request: './A.js' }],
            blocks: [],
          }],
        },
        {
          blocks: [{
            dependencies: [{
              attributes: { mode: 'async' },
              request: './B.js',
            }],
            blocks: [],
          }],
        },
      ],
      { chunks: [chunkA] },
    );
    // Different requests, each with a single mode -> no conflict.
    expect(errors).toHaveLength(0);
  });
});
