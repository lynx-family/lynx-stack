// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { defineConfig } from '@playwright/test';

const port = 4211;

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  globalSetup: './tests/e2e/global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  reporter: [['list']],
  webServer: {
    command: `node scripts/serve.mjs ${port}`,
    url: `http://localhost:${port}/`,
    reuseExistingServer: !process.env['CI'],
  },
  use: {
    baseURL: `http://localhost:${port}/`,
    browserName: 'chromium',
    channel: 'chromium',
    trace: 'retain-on-failure',
  },
});
