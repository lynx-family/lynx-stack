// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { defineProject, type UserWorkspaceConfig } from 'vitest/config';

const config: UserWorkspaceConfig = defineProject({
  test: {
    name: 'i18n/i18next-translation-dedupe',
    exclude: ['lib/**'],
    include: ['tests/**/*.test.ts'],
  },
});

export default config;
