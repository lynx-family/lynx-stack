// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineConfig } from '@rstest/core';

const config: ReturnType<typeof defineConfig> = defineConfig({
  name: 'genui/ui-judge',
  globals: true,
  testEnvironment: 'node',
  pool: 'forks',
  hookTimeout: 60_000,
  include: ['tests/**/*.vitest.spec.ts'],
  testTimeout: 60_000,
});

export default config;
