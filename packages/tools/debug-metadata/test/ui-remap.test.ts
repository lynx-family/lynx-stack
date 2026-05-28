// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test, vi } from 'vitest';

import type { DebugMetadataAsset } from '../src/types.js';
import {
  assertUiNode,
  buildUiSourceMapLookup,
  normalizeRepo,
  remapUiTree,
} from '../src/ui-remap.js';
import type { UiNode } from '../src/ui-remap.js';

function metadata(
  remoteUrl: string,
  uiSourceMap: DebugMetadataAsset['uiSourceMap'],
): DebugMetadataAsset {
  return {
    artifacts: [],
    uiSourceMap,
    meta: {
      git: {
        commit: 'deadbeef',
        rootDir: null,
        remoteUrl,
        commitUrl: null,
      },
    },
  };
}

describe('buildUiSourceMapLookup', () => {
  test('joins uiMaps[i] (nodeIndex) with mappings[i] = [sourceIndex, line, column]', () => {
    const lookup = buildUiSourceMapLookup({
      version: 1,
      sources: ['src/a.tsx', 'src/b.tsx'],
      mappings: [[0, 3, 1], [1, 7, 4]],
      uiMaps: [101, 202],
    });

    expect(lookup.get(101)).toEqual({
      source: 'src/a.tsx',
      line: 3,
      column: 1,
    });
    expect(lookup.get(202)).toEqual({
      source: 'src/b.tsx',
      line: 7,
      column: 4,
    });
    expect(lookup.has(999)).toBe(false);
  });

  test('falls back to null source when sourceIndex is out of range', () => {
    const lookup = buildUiSourceMapLookup({
      version: 1,
      sources: [],
      mappings: [[5, 1, 2]],
      uiMaps: [1],
    });

    expect(lookup.get(1)).toEqual({ source: null, line: 1, column: 2 });
  });
});

describe('normalizeRepo', () => {
  test.each([
    ['https://example.com/owner/repo.git', 'owner/repo'],
    ['https://github.com/lynx-family/lynx-stack', 'lynx-family/lynx-stack'],
    ['git@github.com:owner/repo.git', 'owner/repo'],
    ['', null],
    [null, null],
    [undefined, null],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeRepo(input)).toBe(expected);
  });
});

describe('remapUiTree', () => {
  const META_URL = 'https://example.com/host.json';

  const load = (): DebugMetadataAsset =>
    metadata('git@github.com:acme/app.git', {
      version: 1,
      sources: ['src/App.tsx', 'src/Button.tsx'],
      mappings: [[0, 3, 1], [1, 12, 4]],
      uiMaps: [9000, 101],
    });

  test('annotates resolvable nodes and leaves everything else untouched', async () => {
    const input: UiNode = {
      sign: 1,
      tag: 'page',
      nodeIndex: 9000,
      debugMetadataUrl: META_URL,
      eventNames: [],
      children: [
        {
          sign: 2,
          tag: 'view',
          nodeIndex: 101,
          debugMetadataUrl: META_URL,
          children: [],
        },
        {
          // unresolved: nodeIndex absent from the map
          sign: 3,
          tag: 'text',
          nodeIndex: 404,
          debugMetadataUrl: META_URL,
          children: [],
        },
      ],
    };

    const output = await remapUiTree(input, () => Promise.resolve(load()));

    // root resolved
    expect(output).toMatchObject({
      sign: 1,
      tag: 'page',
      repo: 'acme/app',
      source: 'src/App.tsx',
      line: 3,
      column: 1,
    });
    // resolved child
    expect(output.children?.[0]).toMatchObject({
      repo: 'acme/app',
      source: 'src/Button.tsx',
      line: 12,
      column: 4,
    });
    // unresolved child gains no location fields, keeps original shape
    expect(output.children?.[1]).toEqual({
      sign: 3,
      tag: 'text',
      nodeIndex: 404,
      debugMetadataUrl: META_URL,
      children: [],
    });
    // input is not mutated
    expect(input).not.toHaveProperty('repo');
  });

  test('appends location fields after the original keys (children before repo)', async () => {
    const output = await remapUiTree(
      { sign: 1, nodeIndex: 9000, debugMetadataUrl: META_URL, children: [] },
      () => Promise.resolve(load()),
    );

    expect(Object.keys(output)).toEqual([
      'sign',
      'nodeIndex',
      'debugMetadataUrl',
      'children',
      'repo',
      'source',
      'line',
      'column',
    ]);
  });

  test('loads each distinct debugMetadataUrl only once', async () => {
    const loader = vi.fn(() => Promise.resolve(load()));
    await remapUiTree(
      {
        nodeIndex: 9000,
        debugMetadataUrl: META_URL,
        children: [
          { nodeIndex: 101, debugMetadataUrl: META_URL },
          { nodeIndex: 9000, debugMetadataUrl: META_URL },
        ],
      },
      loader,
    );

    expect(loader).toHaveBeenCalledTimes(1);
  });

  test('throws a descriptive error when loaded JSON lacks a valid uiSourceMap', async () => {
    // The old two-file format: a "meta" block but no embedded uiSourceMap.
    const malformed = { meta: { git: { remoteUrl: 'x' } } } as never;
    await expect(
      remapUiTree(
        { nodeIndex: 9000, debugMetadataUrl: META_URL },
        () => Promise.resolve(malformed),
      ),
    ).rejects.toThrow(/Invalid debug-metadata loaded from "[^"]+"/);
  });

  test('passes nodes without source mapping through, never loading metadata', async () => {
    const loader = vi.fn(() => Promise.resolve(load()));
    const output = await remapUiTree(
      {
        // root has no nodeIndex/debugMetadataUrl (e.g. raw text)
        sign: 1,
        tag: 'raw-text',
        children: [{ sign: 2, tag: 'raw-text' }],
      },
      loader,
    );

    expect(loader).not.toHaveBeenCalled();
    expect(output).toEqual({
      sign: 1,
      tag: 'raw-text',
      children: [{ sign: 2, tag: 'raw-text' }],
    });
  });
});

describe('assertUiNode', () => {
  test('accepts a well-formed node tree', () => {
    expect(() =>
      assertUiNode({
        nodeIndex: 1,
        debugMetadataUrl: 'x',
        children: [{ nodeIndex: 2, debugMetadataUrl: 'y' }],
      })
    ).not.toThrow();
  });

  test('accepts nodes that omit nodeIndex / debugMetadataUrl', () => {
    // e.g. raw-text nodes the engine emits without a nodeIndex.
    expect(() => assertUiNode({ sign: 1, tag: 'raw-text' })).not.toThrow();
    expect(() =>
      assertUiNode({
        nodeIndex: 1,
        debugMetadataUrl: 'x',
        children: [{ sign: 2, tag: 'raw-text' }],
      })
    ).not.toThrow();
  });

  test.each([
    [42, /at \$: expected an object/],
    [{ nodeIndex: 'x' }, /at \$: "nodeIndex" must be a number/],
    [{ debugMetadataUrl: 5 }, /at \$: "debugMetadataUrl" must be a string/],
    [{ children: {} }, /at \$: "children" must be an array/],
  ])('rejects %o', (value, pattern) => {
    expect(() => assertUiNode(value)).toThrow(pattern);
  });

  test('reports the path of a malformed descendant', () => {
    expect(() =>
      assertUiNode({
        nodeIndex: 1,
        debugMetadataUrl: 'x',
        children: [
          { nodeIndex: 2, debugMetadataUrl: 'y' },
          { nodeIndex: 'bad' },
        ],
      })
    ).toThrow(/at \$\.children\[1\]: "nodeIndex" must be a number/);
  });
});
