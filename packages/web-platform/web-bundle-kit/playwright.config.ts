// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { defineConfig } from '@playwright/test';

// End-to-end tests of the built kit (`dist/`). Run `pnpm turbo build` first.
//
// They report no coverage. The kit runs in a dedicated Worker, and
// Playwright's `page.coverage`, which web-core-e2e and web-preview-kit use,
// only measures the scripts of a page's main thread.
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  // A ReactLynx project that the tests build, not tests.
  testIgnore: 'fixture/**',
  // The first build loads Rspack's wasm; a build takes a few seconds.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  // `printSteps` lists the steps of each test with their durations.
  reporter: [['list', { printSteps: true }]],
  use: {
    browserName: 'chromium',
    channel: 'chromium',
    trace: 'retain-on-failure',
  },
});
