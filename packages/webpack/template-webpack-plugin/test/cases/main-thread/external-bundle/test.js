/*
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
/// <reference types="@rstest/core/globals" />

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

it('should hold every main-thread chunk as its own section', async () => {
  const tasm = JSON.parse(
    await fs.readFile(
      path.join(__dirname, '..', '.rspeedy', 'bundle', 'tasm.json'),
      'utf-8',
    ),
  );

  expect(Object.keys(tasm.customSections).sort()).toStrictEqual([
    'a',
    'a__main_thread',
    'b',
    'b__main_thread',
  ]);
  expect(tasm.customSections['a__main_thread'].content).toContain('**aaa**');
  expect(tasm.customSections['b__main_thread'].content).toContain('**bbb**');
  expect(tasm.lepusCode).toBeUndefined();
});
