// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import path from 'node:path';

import { bench, describe } from 'vitest';

import { createRspeedy, loadConfig } from '@lynx-js/rspeedy';

describe('React', () => {
  bench('hello-world', async () => {
    const cwd = path.resolve(__dirname, 'cases/react-hello-world');

    const { content: rspeedyConfig } = await loadConfig({
      cwd,
    });

    const rspeedy = await createRspeedy({
      cwd,
      rspeedyConfig,
    });

    await rspeedy.build();
  });
});
