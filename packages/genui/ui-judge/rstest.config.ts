// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineConfig } from '@rstest/core';

const config: ReturnType<typeof defineConfig> = defineConfig({
  name: 'genui/ui-judge',
  globals: true,
  testEnvironment: 'node',
  // The Android-integration suite (UI_JUDGE_ANDROID_INTEGRATION=1) shares a
  // single emulator / Lynx Explorer instance and ADB port reverses across test
  // files, so files must run serially via `pool.maxWorkers: 1`.
  pool: { type: 'forks', maxWorkers: 1 },
  hookTimeout: 60_000,
  include: ['tests/**/*.rstest.spec.ts'],
  testTimeout: 60_000,
});

export default config;
