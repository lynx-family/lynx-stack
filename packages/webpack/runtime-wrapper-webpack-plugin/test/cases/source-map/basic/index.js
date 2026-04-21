/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
/// <reference types="@rspack/test-tools/rstest" />
// @ts-check

import fs from 'node:fs/promises';
import path from 'node:path';

import { checkSourceMap } from '@lynx-js/test-tools/lib/helper/checkSourceMap.js';

import './a.js';

it('should have source-map', async () => {
  const source = await fs.readFile(
    path.resolve(__filename + '.map'),
    'utf-8',
  );
  const map = JSON.parse(source);

  expect(source).not.toBe('');
  expect(map).toHaveProperty(['sources']);
  expect(map).toHaveProperty(['mappings']);
});

it('should have sourcemap link', async () => {
  const source = await fs.readFile(__filename, 'utf-8');

  expect(
    source.endsWith(`//# sourceMappingURL=${path.basename(__filename)}.map`),
  ).toBeTruthy();
});

it('should verify sourcemap', async () => {
  const source = await fs.readFile(
    path.resolve(__filename + '.map'),
    'utf-8',
  );
  const map = JSON.parse(source);

  expect(map.sources).toMatchObject(
    expect.arrayContaining([
      'webpack:///./source-map/basic/a.js',
      'webpack:///./source-map/basic/b.js',
      'webpack:///./source-map/basic/c.js',
      'webpack:///./source-map/basic/index.js',
    ]),
  );

  const out = await fs.readFile(__filename, { encoding: 'utf-8' });
  await checkSourceMap(out, source, {
    '(\'*a0*\')': 'webpack:///source-map/basic/a.js',
    '(\'*a1*\')': 'webpack:///source-map/basic/a.js',
    '(\'*b0*\')': 'webpack:///source-map/basic/b.js',
    '(\'*b1*\')': 'webpack:///source-map/basic/b.js',
  });
  expect(true).toBe(true);
});
