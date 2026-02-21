// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { type defineConfig, devices } from '@playwright/test';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(import.meta.url);
const dir = path.join(__dirname, '..', '..', '.nyc_output');
await fs.mkdir(dir, { recursive: true });
process.env['LIBGL_ALWAYS_SOFTWARE'] = 'true'; // https://github.com/microsoft/playwright/issues/32151
process.env['GALLIUM_HUD_SCALE'] = '1';
const isCI = !!process.env['CI'];
const port = process.env['PORT'] ?? 3080;
const workerLimit = Math.floor(((cpuCount, envCPULimit) => {
  if (isCI) {
    if (envCPULimit) {
      return envCPULimit / 2;
    } else {
      if (cpuCount <= 32) {
        return 8;
      } else {
        return 8 + (cpuCount - 32) / 6;
      }
    }
  }
  return cpuCount / 2;
})(os.cpus().length, parseFloat(process.env['cpu_limit'] ?? '0')));

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export const playwrightConfigCommon: Parameters<typeof defineConfig>[0] = {
  /** global timeout https://playwright.dev/docs/test-timeouts#global-timeout */
  globalTimeout: 20 * 60 * 1000,
  testMatch: '**/tests/*',
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
            '--disable-gpu',
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
};
