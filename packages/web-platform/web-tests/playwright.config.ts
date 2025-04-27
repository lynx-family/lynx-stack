// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { defineConfig, devices } from '@playwright/test';

process.env['LIBGL_ALWAYS_SOFTWARE'] = 'true'; // https://github.com/microsoft/playwright/issues/32151
process.env['GALLIUM_HUD_SCALE'] = '1';
const isCI = !!process.env.CI;
const ALL_ON_UI = !!process.env.ALL_ON_UI;
const port = process.env.PORT ?? 3080;
const workerLimit = process.env['cpu_limit']
  ? Math.floor(parseFloat(process.env['cpu_limit']) / 2)
  : undefined;

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  /** global timeout https://playwright.dev/docs/test-timeouts#global-timeout */
  globalTimeout: 20 * 60 * 1000,
  testDir: './tests',
  testMatch: ALL_ON_UI ? '**/{react,web-core}.{test,spec}.ts' : undefined,
  /* Run tests in files in parallel */
  fullyParallel: true,
  workers: isCI ? workerLimit : undefined,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!isCI,
  /* Retry on CI only */
  retries: isCI ? 4 : 0,
  // maxFailures: 16,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  maxFailures: isCI ? 16 : undefined,
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: `http://localhost:${port}/`,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /** Configuration for the `expect` assertion library. */
  expect: {
    /** Configuration for the `pageAssertions.toHaveScreenshot` method. */
    toHaveScreenshot: {
      /** An acceptable ratio of pixels that are different to the total amount of pixels, between 0 and 1.*/
      maxDiffPixelRatio: 0.01,
    },
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'webkit',
      use: {
        ...devices['iPhone 12 Pro'],
      },
    },
    {
      name: 'chromium',
      use: {
        ...devices['Pixel 5'],
        // channel: 'chromium',
        launchOptions: {
          // ignoreDefaultArgs: ['--headless'],
          args: [
            // '--headless=new',
            '--browser-ui-tests-verify-pixels',
            '--browser-test',
            '--font-render-hinting=none',
            '--disable-skia-runtime-opts',
            '--disable-font-subpixel-positioning',
            '--disable-lcd-text',
            '--disable-composited-antialiasing',
            '--disable-system-font-check',
            '--force-device-scale-factor=1',
            '--touch-slop-distance=5',
            '--disable-low-res-tiling',
            '--disable-smooth-scrolling',
            '--diable-gpu',
          ],
        },
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox HiDPI'],
        deviceScaleFactor: 1,
      },
    },
  ].filter((e) => e),

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run serve',
    url: `http://localhost:${port}`,
    reuseExistingServer: !isCI,
  },
});
