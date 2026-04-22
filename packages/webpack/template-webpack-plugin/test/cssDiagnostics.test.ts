// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import type { CSSSourceMap } from '@lynx-js/css-serializer';

import {
  dedupeTasmCSSDiagnostics,
  extractTasmCSSDiagnostics,
  resolveTasmCSSDiagnostics,
} from '../src/cssDiagnostics.js';

describe('cssDiagnostics', () => {
  test('extract tasm css diagnostics from JSON string', () => {
    expect(
      extractTasmCSSDiagnostics(
        '[{"type":"property","name":"unknown-prop","line":4,"column":15}]',
      ),
    ).toEqual([
      {
        type: 'property',
        name: 'unknown-prop',
        line: 4,
        column: 15,
      },
    ]);

    expect(extractTasmCSSDiagnostics('[]')).toEqual([]);
  });

  test('resolve tasm css diagnostics with css source map', () => {
    const sourceMap: CSSSourceMap = {
      version: 3,
      file: '.rspeedy/main/main.css',
      sources: ['webpack:/src/app.css'],
      sourcesContent: [
        '.foo {\n  unknown-prop: red;\n}\n',
      ],
      names: [],
      mappings: 'AAAA;EACE,kBAAkB;AACpB',
    };

    const resolved = resolveTasmCSSDiagnostics({
      cssDiagnostics: [
        {
          type: 'property',
          name: 'unknown-prop',
          line: 2,
          column: 10,
        },
      ],
      mainCSSSourceMap: sourceMap,
      context: '/workspace/app',
      fileExists: () => true,
    });

    expect(resolved).toEqual([
      {
        type: 'property',
        name: 'unknown-prop',
        line: 2,
        column: 10,
        message:
          'Unsupported property "unknown-prop" was removed during template encode.',
        sourceFile: '/workspace/app/src/app.css',
        sourceLine: 2,
        sourceColumn: 3,
      },
    ]);
  });

  test('skip mapped source when file does not exist', () => {
    const sourceMap: CSSSourceMap = {
      version: 3,
      file: '.rspeedy/main/main.css',
      sources: ['file:///src/app.css'],
      sourcesContent: [
        '.foo {\n  unknown-prop: red;\n}\n',
      ],
      names: [],
      mappings: 'AAAA;EACE,kBAAkB;AACpB',
    };

    const resolved = resolveTasmCSSDiagnostics({
      cssDiagnostics: [
        {
          type: 'property',
          name: 'unknown-prop',
          line: 2,
          column: 10,
        },
      ],
      mainCSSSourceMap: sourceMap,
      context: '/workspace/app',
      fileExists: () => false,
    });

    expect(resolved).toEqual([
      {
        type: 'property',
        name: 'unknown-prop',
        line: 2,
        column: 10,
        message:
          'Unsupported property "unknown-prop" was removed during template encode.',
      },
    ]);
  });

  test('dedupe resolved tasm css diagnostics by message and location', () => {
    const diagnostics = [
      {
        type: 'property',
        name: 'unknown-prop',
        line: 2,
        column: 10,
        message:
          'Unsupported property "unknown-prop" was removed during template encode.',
        sourceFile: '/workspace/app/src/app.css',
        sourceLine: 4,
        sourceColumn: 3,
      },
      {
        type: 'property',
        name: 'unknown-prop',
        line: 2,
        column: 10,
        message:
          'Unsupported property "unknown-prop" was removed during template encode.',
        sourceFile: '/workspace/app/src/app.css',
        sourceLine: 4,
        sourceColumn: 3,
      },
      {
        type: 'property',
        name: 'unknown-prop',
        line: 8,
        column: 10,
        message:
          'Unsupported property "unknown-prop" was removed during template encode.',
        sourceFile: '/workspace/app/src/app.css',
        sourceLine: 8,
        sourceColumn: 3,
      },
    ];

    expect(dedupeTasmCSSDiagnostics(diagnostics)).toEqual([
      diagnostics[0],
      diagnostics[2],
    ]);
  });

  test('dedupe resolved tasm css diagnostics across batches', () => {
    const seen = new Set<string>();
    const diagnostic = {
      type: 'property',
      name: 'unknown-prop',
      line: 2,
      column: 10,
      message:
        'Unsupported property "unknown-prop" was removed during template encode.',
      sourceFile: '/workspace/app/src/app.css',
      sourceLine: 4,
      sourceColumn: 3,
    };

    expect(dedupeTasmCSSDiagnostics([diagnostic], seen)).toEqual([
      diagnostic,
    ]);
    expect(dedupeTasmCSSDiagnostics([diagnostic], seen)).toEqual([]);
  });
});
