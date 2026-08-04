// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { defineConfig, devices } from '@playwright/test';
import { playwrightConfigCommon } from '@lynx-js/playwright-fixtures';

/**
 * The boundary matrix, on Chromium only and in a single worker.
 *
 * Single worker because the suite accumulates one report of every frame it
 * captures, and that report is only complete if one process saw them all.
 * Chromium only because the claim under test is about which *thread* built
 * the frame, which no browser difference bears on.
 */
const executablePath = process.env['LYNX_CHROMIUM_EXECUTABLE'];

export default defineConfig({
  ...playwrightConfigCommon,
  testMatch: '**/tests/island-matrix.spec.ts',
  reporter: 'list',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Pixel 5'],
        launchOptions: {
          ...(executablePath ? { executablePath } : {}),
          args: [
            '--font-render-hinting=none',
            '--disable-skia-runtime-opts',
            '--disable-font-subpixel-positioning',
            '--disable-lcd-text',
            '--disable-composited-antialiasing',
            '--disable-system-font-check',
            '--force-device-scale-factor=1',
            '--disable-low-res-tiling',
            '--disable-smooth-scrolling',
            '--disable-gpu',
          ],
        },
      },
    },
  ],
});
