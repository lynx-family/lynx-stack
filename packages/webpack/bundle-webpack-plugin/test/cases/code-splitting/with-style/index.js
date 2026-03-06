/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
/// <reference types="vitest/globals" />

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { foo } from './foo.js';
import './blue.css';

it('should merge content of style chunk to cssMap for main bundle', async () => {
  expect(foo()).toBe(42);

  const tasmJSONPath = resolve(__dirname, '.rspeedy/main/tasm.json');
  expect(existsSync(tasmJSONPath)).toBeTruthy();

  const content = await readFile(tasmJSONPath, 'utf-8');
  const { css } = JSON.parse(content);
  expect(css.cssMap['0'][0].selectorText.value).toBe('.red');
  expect(css.cssMap['0'][1].selectorText.value).toBe('.blue');
});
