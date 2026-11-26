// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import { isHotUpdateAsset } from '../../src/shared/assets.js';
import { isValidProjectPath } from '../../src/shared/paths.js';

describe('isValidProjectPath', () => {
  test.each([
    'src/index.tsx',
    'a',
    'node_modules/pkg/index.js',
    '.lynx/main/tasm.json',
    'src/.hidden',
    'a..b/c',
  ])('accepts %s', (path) => {
    expect(isValidProjectPath(path)).toBe(true);
  });

  test.each([
    '',
    '/src/index.tsx',
    'src//index.tsx',
    'src/',
    './src/index.tsx',
    'src/./index.tsx',
    'src/../index.tsx',
    '..',
    'src\\index.tsx',
    'src/\0',
  ])('rejects %j', (path) => {
    expect(isValidProjectPath(path)).toBe(false);
  });

  test('rejects what is not a string', () => {
    expect(isValidProjectPath(1)).toBe(false);
    expect(isValidProjectPath(undefined)).toBe(false);
  });
});

describe('isHotUpdateAsset', () => {
  test.each([
    'main.0123abcd.hot-update.json',
    'main.0123abcd.hot-update.js',
    'main.0123abcd.hot-update.js.map',
    '.lynx/main/main.0123abcd.css.hot-update.json',
  ])('%s is a hot update', (name) => {
    expect(isHotUpdateAsset(name)).toBe(true);
  });

  test.each(['main.web.bundle', 'main/background.js', 'hot-update/a.js'])(
    '%s is not',
    (name) => {
      expect(isHotUpdateAsset(name)).toBe(false);
    },
  );
});
