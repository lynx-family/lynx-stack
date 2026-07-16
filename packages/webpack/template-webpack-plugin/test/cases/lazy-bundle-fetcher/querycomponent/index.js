/*
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
/// <reference types="@rspack/test-tools/rstest" />

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

void import(/* webpackChunkName: 'foo:main-thread' */ './foo.mts.js');
void import(/* webpackChunkName: 'foo:background' */ './foo.bts.js');

it('QueryComponent (default): lazy bundle keeps lepusCode + manifest shape', async () => {
  const tasmJSONPath = resolve(__dirname, '.rspeedy/lazy-bundle/foo/tasm.json');
  expect(existsSync(tasmJSONPath)).toBeTruthy();

  const tasm = JSON.parse(await readFile(tasmJSONPath, 'utf-8'));
  // Default fetcher path: customSections is empty (legacy slots own MT/BG).
  expect(tasm.customSections['main-thread']).toBeUndefined();
  expect(tasm.customSections['background']).toBeUndefined();
  expect(tasm.lepusCode).toBeDefined();
  expect(tasm.lepusCode.root).toEqual(expect.any(String));
});
