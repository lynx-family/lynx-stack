/*
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
/// <reference types="@rstest/core/globals" />
// @ts-check

import fs from 'node:fs/promises';
import path from 'node:path';

export function loadMainThread() {
  return import('./main-thread.js');
}

it('should wrap the background asset', async () => {
  const source = await fs.readFile(__filename, 'utf-8');

  expect(source).toContain('__bundle__holder');
});

it('should not wrap the asset marked as main thread', async () => {
  const source = await fs.readFile(
    path.join(path.dirname(__filename), 'main-thread.js'),
    'utf-8',
  );

  expect(source).not.toContain('__bundle__holder');
  expect(source).not.toContain('.define(');
});
