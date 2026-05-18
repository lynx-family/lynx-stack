// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { defineConfig } from '@playwright/test';
import { playwrightConfigCommon } from '@lynx-js/playwright-fixtures';

if (process.env['CI']) {
  process.env['CHOKIDAR_USEPOLLING'] ??= '1';
  process.env['CHOKIDAR_INTERVAL'] ??= '1000';
}

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
});
