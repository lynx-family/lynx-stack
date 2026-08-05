// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { defineConfig } from '@playwright/test';
import { playwrightConfigCommon } from '@lynx-js/playwright-fixtures';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  ...playwrightConfigCommon,
  // The `<Background>` island suite keeps a deliberate *pair* of baselines per
  // case (the main thread's own frame, then the hydrated one) and holds the
  // background thread to get the first of them. It runs from
  // `playwright.island.config.ts` on Chromium alone, so it stays out of the
  // cross-browser sweep here.
  testIgnore: '**/background-island.spec.ts',
});
