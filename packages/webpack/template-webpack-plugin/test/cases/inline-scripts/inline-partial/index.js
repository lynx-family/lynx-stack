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
import { bar } from './bar.js';

it('should inline foo, but not inline bar', async () => {
  expect(foo()).toBe(42);
  expect(bar()).toBe(52);

  const tasmJSONPath = resolve(__dirname, '.rspeedy/main/tasm.json');
  expect(existsSync(tasmJSONPath)).toBeTruthy();

  const content = await readFile(tasmJSONPath, 'utf-8');
  const { manifest } = JSON.parse(content);

  expect(manifest).toHaveProperty('/app-service.js');
  expect(Object.keys(manifest).length).toBe(3);
  expect(manifest['/app-service.js']).toBeTruthy();
  expect(manifest['/foo.js']).toBeTruthy();
  // it is inlined because rspack.bundle.js has rspack runtime module which needs to be loaded synchronously
  expect(manifest['/rspack.bundle.js']).toBeTruthy();

  it('inlined scripts should not have syntax error', () => {
    eval(manifest['/app-service.js']);
    eval(manifest['/foo.js']);
  });
});
