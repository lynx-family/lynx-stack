/*
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
/// <reference types="@rstest/core/globals" />

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

it('should pack every background chunk into the bundle', async () => {
  const bundle = await fs.readFile(
    path.join(__dirname, '..', 'bundle', 'template.js'),
    'utf-8',
  );

  expect(bundle).toContain('**aaa**');
  expect(bundle).toContain('**bbb**');
});
