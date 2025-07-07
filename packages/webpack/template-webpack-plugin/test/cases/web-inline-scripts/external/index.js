/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
/// <reference types="vitest/globals" />

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

it('should have correct chunk content', async () => {
  const { foo } = await import(
    /* webpackChunkName: 'foo:background' */
    './foo.js'
  );
  expect(foo()).toBe(42);
});

it('should generate correct web template with external scripts', async () => {
  const outputPath = resolve(__dirname, 'main.bundle');
  expect(existsSync(outputPath)).toBeTruthy();

  const content = await readFile(outputPath, 'utf-8');
  const bundleData = JSON.parse(content);

  expect(bundleData).toHaveProperty('manifest');
  expect(bundleData.manifest).toHaveProperty('/app-service.js');

  // Check that external script file exists (this means scripts were not inlined)
  const externalScriptPath = resolve(
    __dirname,
    'foo:background.rspack.bundle.js',
  );
  expect(existsSync(externalScriptPath)).toBeTruthy();

  const externalContent = await readFile(externalScriptPath, 'utf-8');
  expect(externalContent).toContain('function foo()');
});
