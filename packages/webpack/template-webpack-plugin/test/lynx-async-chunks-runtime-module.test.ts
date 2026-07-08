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
  loc?: { start: { line: number; column: number } };
}

interface FakeBlock {
  dependencies: FakeDependency[];
  loc?: { start: { line: number; column: number } };
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

  test('reports a conflict and falls back to async when a bundle is both sync and async', () => {
    const chunk: FakeChunk = { id: 0, name: 'a' };
    const { out, errors } = run(
      [chunk],
      [
        {
          readableIdentifier: () => 'src/host/first-screen.tsx',
          blocks: [{
            dependencies: [{
              attributes: { mode: 'sync' },
              loc: { start: { line: 12, column: 4 } },
            }],
            blocks: [],
          }],
        },
        {
          readableIdentifier: () => 'src/host/lazy.tsx',
          blocks: [{
            dependencies: [{
              attributes: { mode: 'async' },
              loc: { start: { line: 30, column: 2 } },
            }],
            blocks: [],
          }],
        },
      ],
      { chunks: [chunk] },
    );
    // Conflict reported with both sites, and the mode entry is dropped so the
    // chunk-loading runtime uses its non-blocking async default.
    expect(errors).toHaveLength(1);
    const message = errors[0]!.message;
    expect(message).toContain('\'sync\'');
    expect(message).toContain('\'async\'');
    expect(message).toContain('src/host/first-screen.tsx:12:4');
    expect(message).toContain('src/host/lazy.tsx:30:2');
    expect(out).not.toContain(RuntimeGlobals.lynxAsyncChunkMode);
  });
});
