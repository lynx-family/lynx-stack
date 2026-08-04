// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { defineConfig, devices } from '@playwright/test';
import { playwrightConfigCommon } from '@lynx-js/playwright-fixtures';

/**
 * The `<Background>` island suite, on Chromium only.
 *
 * It is split out from the shared config for two reasons: the screenshots are
 * a deliberate pair per case (main-thread frame vs hydrated) rather than the
 * single-frame baselines the other suites keep, and the browser is pinned to
 * whatever this environment provides via `LYNX_CHROMIUM_EXECUTABLE` so a
 * revision skew between the installed Playwright and the downloaded browsers
 * does not silently disable the run.
 */
const executablePath = process.env['LYNX_CHROMIUM_EXECUTABLE'];

export default defineConfig({
  ...playwrightConfigCommon,
  testMatch: '**/tests/background-island.spec.ts',
  reporter: 'list',
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
