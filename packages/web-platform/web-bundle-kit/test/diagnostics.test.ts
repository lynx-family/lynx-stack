// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import { toDiagnostic } from '../src/diagnostics.js';

const root = '/project';

describe('toDiagnostic', () => {
  test('a loader error with loc (as Rspack reports a JSX syntax error)', () => {
    // Shape observed in the e2e run.
    const message = '  × ModuleError: Unexpected token.\n   ╭─[3:0]\n 3 │ }\n';
    expect(
      toDiagnostic(root, {
        message,
        loc: '3:1',
        moduleIdentifier:
          'javascript/auto|/node_modules/@lynx-js/react-webpack-plugin/lib/loaders/background.js??ruleSet[1]!/project/src/main/App.tsx|react:background',
        moduleName: './src/main/App.tsx',
      }),
    ).toEqual({ message, file: 'src/main/App.tsx', line: 3, column: 1 });
  });

  test('a range loc keeps its start', () => {
    expect(
      toDiagnostic(root, { message: 'm', loc: '12:5-9', moduleName: './a.ts' }),
    ).toEqual({
      message: 'm',
      file: 'a.ts',
      line: 12,
      column: 5,
    });
  });

  test('falls back to a code frame with a path (0-based column)', () => {
    const message = 'x\n  ╭─[/project/src/b.css:4:2]\n';
    expect(toDiagnostic(root, { message })).toEqual({
      message,
      file: 'src/b.css',
      line: 4,
      column: 3,
    });
  });

  test('falls back to a path:line:column in the message', () => {
    const message = 'Error in /project/src/c.ts:7:9 something';
    expect(toDiagnostic(root, { message })).toEqual({
      message,
      file: 'src/c.ts',
      line: 7,
      column: 9,
    });
  });

  test('ignores a frame for another file', () => {
    const message = '╭─[/project/src/other.ts:1:0]';
    expect(toDiagnostic(root, { message, moduleName: './src/a.ts' })).toEqual({
      message,
      file: 'src/a.ts',
    });
  });

  test('files outside the project have no file', () => {
    expect(
      toDiagnostic(root, {
        message: 'm',
        moduleIdentifier: '/node_modules/x/index.js',
      }),
    ).toEqual({ message: 'm' });
  });

  test('a message alone', () => {
    expect(toDiagnostic(root, { message: 'fatal' })).toEqual({
      message: 'fatal',
    });
  });
});
