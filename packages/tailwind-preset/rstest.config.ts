// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineConfig } from '@rstest/core';

const config: ReturnType<typeof defineConfig> = defineConfig({
  name: 'tailwind-preset',
  testEnvironment: 'node',
  globals: true,
  include: ['src/**/*.{test,spec}.{js,ts}'],
});

export default config;
