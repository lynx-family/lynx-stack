/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { defineProject } from 'vitest/config';
import type { UserWorkspaceConfig } from 'vitest/config';

const config: UserWorkspaceConfig = defineProject({
  test: {
    env: {
      DEBUG: 'rspeedy',
    },
    name: 'webpack/template',
    setupFiles: ['@lynx-js/vitest-setup/setup.ts'],
  },
});

export default config;
