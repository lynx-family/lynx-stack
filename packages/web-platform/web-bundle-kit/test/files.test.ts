// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from '@rstest/core';

import {
  applyChanges,
  assertChanges,
  checkPath,
  listFiles,
  readFile,
  writeFiles,
} from '../src/files.js';
import type { ProjectFs } from '../src/files.js';

describe('checkPath', () => {
  test.each([
    'a.ts',
    'src/index.tsx',
    'node_modules/pkg/index.js',
    '.env',
    'a/.b/c',
    'a..b',
  ])('accepts %s', (p) => {
    expect(checkPath(p)).toBeUndefined();
  });

  test.each([
    ['', 'empty'],
    ['/abs', 'start with "/"'],
    ['a//b', 'empty segments'],
    ['a/', 'empty segments'],
    ['./a', '"." or ".."'],
    ['a/../b', '"." or ".."'],
    ['..', '"." or ".."'],
    ['a\\b', 'separator'],
  ])('rejects %j', (p, reason) => {
    expect(checkPath(p)).toContain(reason);
  });

  test('rejects non-strings', () => {
    expect(checkPath(1)).toBe('a path must be a string');
  });
});

describe('assertChanges', () => {
  test('checks every change before any is applied', () => {
    expect(() =>
      assertChanges([
        { type: 'write', path: 'ok.ts', content: '' },
        { type: 'write', path: '../x', content: '' },
      ])
    ).toThrow(TypeError);
    expect(() => assertChanges([{ type: 'move', path: 'a' }])).toThrow(
      /type must be/,
    );
    expect(() => assertChanges([{ type: 'write', path: 'a', content: 1 }]))
      .toThrow(/content/);
    expect(() => assertChanges([{ type: 'rename', from: 'a', to: '/b' }]))
      .toThrow(/Invalid path/);
  });
});

describe('applyChanges', () => {
  let root: string;
  const pfs = fs as unknown as ProjectFs;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'web-bundle-kit-'));
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('writes files and creates directories', () => {
    writeFiles(pfs, root, {
      'src/a.ts': 'a',
      'img.png': new Uint8Array([1, 2, 3]),
    });
    expect(listFiles(pfs, root)).toEqual(['img.png', 'src/a.ts']);
    expect(readFile(pfs, root, 'img.png')).toEqual(new Uint8Array([1, 2, 3]));
    expect(new TextDecoder().decode(readFile(pfs, root, 'src/a.ts'))).toBe('a');
    expect(readFile(pfs, root, 'missing.ts')).toBeUndefined();
    expect(readFile(pfs, root, 'src')).toBeUndefined();
  });

  test('reports changed and removed files, in order', () => {
    writeFiles(pfs, root, {
      'src/a.ts': 'a',
      'src/b.ts': 'b',
      'lib/c.ts': 'c',
    });
    const applied = applyChanges(pfs, root, [
      { type: 'write', path: 'src/a.ts', content: 'a2' },
      { type: 'delete', path: 'lib' },
      { type: 'delete', path: 'does/not/exist' },
      { type: 'rename', from: 'src', to: 'app/src' },
      { type: 'write', path: 'app/src/b.ts', content: 'b2' },
    ]);
    expect(listFiles(pfs, root)).toEqual(['app/src/a.ts', 'app/src/b.ts']);
    expect([...applied.changed].sort()).toEqual([
      `${root}/app/src/a.ts`,
      `${root}/app/src/b.ts`,
    ]);
    expect([...applied.removed].sort()).toEqual([
      `${root}/lib/c.ts`,
      `${root}/src/a.ts`,
      `${root}/src/b.ts`,
    ]);
  });

  test('a write after a delete of the same file is a change', () => {
    writeFiles(pfs, root, { 'a.ts': 'a' });
    const applied = applyChanges(pfs, root, [
      { type: 'delete', path: 'a.ts' },
      { type: 'write', path: 'a.ts', content: 'again' },
    ]);
    expect([...applied.changed]).toEqual([`${root}/a.ts`]);
    expect([...applied.removed]).toEqual([]);
  });

  test('rename of a missing path or into itself throws', () => {
    writeFiles(pfs, root, { 'a/b.ts': 'b' });
    expect(() =>
      applyChanges(pfs, root, [{ type: 'rename', from: 'x', to: 'y' }])
    ).toThrow(
      /does not exist/,
    );
    expect(() =>
      applyChanges(pfs, root, [{ type: 'rename', from: 'a', to: 'a/c' }])
    ).toThrow(
      /into itself/,
    );
  });

  test('rename replaces the target', () => {
    writeFiles(pfs, root, { 'a.ts': 'a', 'b.ts': 'b' });
    applyChanges(pfs, root, [{ type: 'rename', from: 'a.ts', to: 'b.ts' }]);
    expect(listFiles(pfs, root)).toEqual(['b.ts']);
    expect(new TextDecoder().decode(readFile(pfs, root, 'b.ts'))).toBe('a');
  });
});
