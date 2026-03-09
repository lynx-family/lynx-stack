/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
/// <reference types="vitest/globals" />

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

it('should merge content of style chunk to cssMap for a lazy bundle', async () => {
  await import(/* webpackChunkName: 'test' */ './foo.js');

  const tasmJSONPath = join(__dirname, 'async', 'test', 'tasm.json');
  const content = await readFile(tasmJSONPath, 'utf-8');
  const { css } = JSON.parse(content);
  expect(css.cssMap['0'][0].selectorText.value).toBe('.red');
  expect(css.cssMap['0'][1].selectorText.value).toBe('.blue');
});
