// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { afterEach, describe, expect, rs, test } from '@rstest/core';

import { supportNapi } from '@lynx-js/tasm';

import encode from '../src/worker/encode.js';

const context = path.dirname(fileURLToPath(import.meta.url));
const tasmPkg = pathToFileURL(
  path.join(context, 'fixtures/mock-tasm.mjs'),
).href;
const encodeOptions = {
  compilerOptions: { targetSdkVersion: '3.2' },
  sourceContent: {
    dsl: 'react_nodiff',
    appType: 'card',
    config: {},
  },
  css: {
    cssMap: {},
    cssSource: {},
  },
  lepusCode: { lepusChunk: {} },
  manifest: {},
  customSections: {},
};

interface EncodeTraceRow {
  name: string;
  duration_us: number;
  duration_ms: number;
}

function isEncodeTraceRow(value: unknown): value is EncodeTraceRow {
  return typeof value === 'object'
    && value !== null
    && 'name' in value
    && typeof value.name === 'string'
    && 'duration_us' in value
    && typeof value.duration_us === 'number'
    && 'duration_ms' in value
    && typeof value.duration_ms === 'number';
}

// The encode trace is printed by `@lynx-js/tasm`'s native binding, and that
// package ships prebuilt binaries for two platforms only (`build/darwin`,
// `build/linux`). Anywhere else `getEncodeMode()` falls back to wasm, which
// emits neither the trace header nor the `console.table` — so on Windows the
// trace assertion is testing a capability the platform does not have, not
// `encode`'s behaviour.
//
// Ask tasm rather than restating its rule: a local copy of the predicate would
// go stale by SKIPPING a test that should run, and a skip turns nothing red.
// Only the case that consumes real trace output is gated; the rest use the mock
// TASM and run everywhere.
const testWithNativeTasm = supportNapi() ? test : test.skip;

describe('encode worker trace configuration', () => {
  afterEach(() => {
    rs.restoreAllMocks();
    rs.unstubAllEnvs();
  });

  test.each(
    [
      ['rspeedy:template', true],
      ['rspeedy:*', true],
      ['rspeedy', false],
      ['*', false],
      ['other', false],
    ] as const,
  )(
    'passes DEBUG=%s as trace=%s to the TASM encoder',
    async (debugEnv, expected) => {
      rs.stubEnv('DEBUG', debugEnv);
      rs.spyOn(console, 'log').mockImplementation(() => void 0);
      const result = await encode({
        encodeOptions: {},
        tasmPkg,
      });

      expect(result.lepus_code).toBe(String(expected));
    },
  );

  testWithNativeTasm('prints the TASM encode trace when enabled', async () => {
    rs.stubEnv('DEBUG', 'rspeedy:template');
    const log = rs.spyOn(console, 'log').mockImplementation(() => void 0);
    const table = rs.spyOn(console, 'table').mockImplementation(() => void 0);

    await encode({
      encodeOptions,
    });

    expect(log.mock.calls).toEqual([
      ['[TASM Encode Trace]'],
      ['[TASM Encode Trace] End!\n'],
    ]);
    expect(table).toHaveBeenCalledTimes(1);
    const tableOutput: unknown = table.mock.calls[0]?.[0];
    const traceRows = Array.isArray(tableOutput)
      ? tableOutput.filter(row => isEncodeTraceRow(row))
      : [];
    const encodeRow = traceRows.find(row => row.name === 'Encode');

    expect(typeof encodeRow?.duration_us).toBe('number');
    expect(typeof encodeRow?.duration_ms).toBe('number');
    expect(traceRows.some(row => row.name === 'ParseEncodeOptions')).toBe(true);
  });

  test('does not print the TASM encode trace when disabled', async () => {
    rs.stubEnv('DEBUG', 'rspeedy');
    const log = rs.spyOn(console, 'log').mockImplementation(() => void 0);
    const table = rs.spyOn(console, 'table').mockImplementation(() => void 0);

    await encode({
      encodeOptions,
    });

    expect(log).not.toHaveBeenCalled();
    expect(table).not.toHaveBeenCalled();
  });
});
