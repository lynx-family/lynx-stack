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

it('FetchBundle: lazy bundle tasm.json carries customSections shape', async () => {
  const tasmJSONPath = resolve(__dirname, '.rspeedy/lazy-bundle/foo/tasm.json');
  expect(existsSync(tasmJSONPath)).toBeTruthy();

  const tasm = JSON.parse(await readFile(tasmJSONPath, 'utf-8'));
  // FetchBundle moves MT/BG/CSS into customSections and drops the legacy
  // lepusCode + manifest slots for lazy bundles.
  expect(tasm.customSections).toHaveProperty('main-thread');
  expect(tasm.customSections).toHaveProperty('background');
  expect(tasm.customSections['main-thread'].content).toEqual(
    expect.any(String),
  );
  expect(tasm.customSections['background'].content).toEqual(expect.any(String));
  expect(tasm.lepusCode).toBeUndefined();
  expect(tasm.css.cssMap).toEqual({});
});
