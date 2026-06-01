// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from 'vitest';

import {
  FIELDS,
  findArtifact,
  findBytecodeDebugInfo,
  findSourceMap,
  knownFields,
  resolveField,
} from '../src/resolve.js';
import type { DebugMetadataAsset, SourceMap } from '../src/types.js';

const SAMPLE_MAP: SourceMap = {
  version: 3,
  sources: ['src/index.ts'],
  names: [],
  mappings: '',
};

const SAMPLE: DebugMetadataAsset = {
  artifacts: [
    {
      kind: 'main-thread',
      filename: 'main-thread.js',
      path: '.rspeedy/main/main-thread.js',
      tasmSection: ['lepusCode', 'root'],
      debugSources: [
        {
          kind: 'bytecode-debug-info',
          debugInfo: {
            lepusNG_debug_info: {
              function_source: 'function foo(){}',
              function_number: 1,
              end_line_num: 1,
              function_info: [],
            },
          },
        },
        {
          kind: 'source-map',
          filename: 'main-thread.js.map',
          path: '.rspeedy/main/main-thread.js.map',
          key: 'mt-hash',
          map: SAMPLE_MAP,
        },
      ],
    },
    {
      kind: 'background',
      filename: 'background.abc.js',
      path: '.rspeedy/main/background.abc.js',
      debugSources: [
        {
          kind: 'source-map',
          filename: 'background.abc.js.map',
          path: '.rspeedy/main/background.abc.js.map',
          key: 'bg-hash',
          map: SAMPLE_MAP,
        },
      ],
    },
  ],
  uiSourceMap: { version: 1, sources: [], mappings: [], uiMaps: [] },
  buildInfo: {
    git: {
      branch: 'main',
      commit: 'deadbeef',
      rootDir: '/tmp/repo',
      remoteUrl: 'https://example.com/owner/repo',
      commitUrl: 'https://example.com/owner/repo/commit/deadbeef',
    },
    rspeedy: { entryFiles: ['src/index.ts'], bundlePath: 'main/template.js' },
  },
};

describe('findArtifact', () => {
  test('returns the artifact whose filename matches', () => {
    expect(findArtifact(SAMPLE, { filename: 'main-thread.js' })?.kind).toBe(
      'main-thread',
    );
  });

  test('returns undefined when no artifact matches', () => {
    expect(findArtifact(SAMPLE, { filename: 'nope.js' })).toBeUndefined();
  });
});

describe('findSourceMap', () => {
  test('matches by filename', () => {
    expect(findSourceMap(SAMPLE, { filename: 'main-thread.js.map' })?.key)
      .toBe('mt-hash');
  });

  test('matches by path', () => {
    expect(
      findSourceMap(SAMPLE, {
        path: '.rspeedy/main/background.abc.js.map',
      })?.key,
    ).toBe('bg-hash');
  });

  test('matches by key', () => {
    expect(findSourceMap(SAMPLE, { key: 'bg-hash' })?.filename)
      .toBe('background.abc.js.map');
  });

  test('returns undefined when no source-map matches', () => {
    expect(findSourceMap(SAMPLE, { filename: 'nope.js.map' })).toBeUndefined();
  });

  test('all provided filters must match', () => {
    expect(
      findSourceMap(SAMPLE, {
        filename: 'main-thread.js.map',
        key: 'bg-hash',
      }),
    ).toBeUndefined();
  });
});

describe('findBytecodeDebugInfo', () => {
  test('returns the bytecode debug source attached to the artifact', () => {
    const res = findBytecodeDebugInfo(SAMPLE, { filename: 'main-thread.js' });
    expect(res?.kind).toBe('bytecode-debug-info');
    expect(res?.debugInfo.lepusNG_debug_info.function_source).toBe(
      'function foo(){}',
    );
  });

  test('returns undefined when artifact has no bytecode debug source', () => {
    expect(findBytecodeDebugInfo(SAMPLE, { filename: 'background.abc.js' }))
      .toBeUndefined();
  });

  test('returns undefined when no artifact matches', () => {
    expect(findBytecodeDebugInfo(SAMPLE, { filename: 'nope.js' }))
      .toBeUndefined();
  });
});

describe('resolveField', () => {
  test('returns undefined for an unknown field name', () => {
    expect(resolveField(SAMPLE, 'bogus-field')).toBeUndefined();
  });

  test('returns { found: false } when the field is known but no match', () => {
    expect(resolveField(SAMPLE, 'source-map', { filename: 'nope.js.map' }))
      .toEqual({ found: false });
  });

  test('returns the inner SourceMap payload (unwrapped) for source-map', () => {
    const res = resolveField(SAMPLE, 'source-map', {
      filename: 'main-thread.js.map',
    });
    expect(res).toEqual({ found: true, payload: SAMPLE_MAP });
  });

  test('returns the inner LepusNGDebugInfo payload for bytecode-debug-info', () => {
    const res = resolveField(SAMPLE, 'bytecode-debug-info', {
      filename: 'main-thread.js',
    });
    expect(res?.found).toBe(true);
    expect(
      (res?.payload as { lepusNG_debug_info: { function_source: string } })
        .lepusNG_debug_info.function_source,
    ).toBe('function foo(){}');
  });

  test('returns the full Artifact for the artifact field', () => {
    const res = resolveField(SAMPLE, 'artifact', {
      filename: 'main-thread.js',
    });
    expect(res?.found).toBe(true);
    expect((res?.payload as { kind: string }).kind).toBe('main-thread');
  });

  test('returns the whole array for the artifacts field', () => {
    const res = resolveField(SAMPLE, 'artifacts');
    expect(res?.found).toBe(true);
    expect((res?.payload as unknown[]).length).toBe(2);
  });

  test('returns ui-source-map / meta / git / rspeedy directly', () => {
    expect(resolveField(SAMPLE, 'ui-source-map')?.payload).toBe(
      SAMPLE.uiSourceMap,
    );
    expect(resolveField(SAMPLE, 'buildInfo')?.payload).toBe(SAMPLE.buildInfo);
    expect(resolveField(SAMPLE, 'git')?.payload).toBe(SAMPLE.buildInfo.git);
    expect(resolveField(SAMPLE, 'rspeedy')?.payload).toBe(
      SAMPLE.buildInfo.rspeedy,
    );
  });
});

describe('FIELDS / knownFields', () => {
  test('knownFields lists every registered field', () => {
    expect(knownFields().sort()).toEqual(
      [
        'artifact',
        'artifacts',
        'bytecode-debug-info',
        'git',
        'buildInfo',
        'rspeedy',
        'source-map',
        'ui-source-map',
      ].sort(),
    );
  });

  test('FIELDS is a live Map — new registrations affect knownFields', () => {
    FIELDS.set('test-only-field', { resolve: () => 'hi' });
    try {
      expect(knownFields()).toContain('test-only-field');
      expect(resolveField(SAMPLE, 'test-only-field')).toEqual({
        found: true,
        payload: 'hi',
      });
    } finally {
      FIELDS.delete('test-only-field');
    }
  });
});
