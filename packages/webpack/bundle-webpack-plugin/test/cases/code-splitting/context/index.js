/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
/// <reference types="vitest/globals" />

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

it('should have correct chunk content', async () => {
  const request = async (name) => await import(`./${name}.json`);
  const a = await request('a');
  const b = await request('b');
  expect(a.default.name).toBe('a');
  expect(b.default.name).toBe('b');

  expect(__webpack_require__.lynx_aci).toBeUndefined();
});

it('should not generate bundle for context', () => {
  const tasmJSONPath = resolve(__dirname, '.rspeedy/async/a/tasm.json');
  expect(existsSync(tasmJSONPath)).toBeFalsy();
});
