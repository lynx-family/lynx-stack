// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from '@rstest/core';
import type { RstestConfig } from '@rstest/core';

import { withDefaultConfig } from '@lynx-js/react/testing-library/rstest-config';

const root = path.dirname(fileURLToPath(import.meta.url));

// Explicitly typed: the package compiles with `--isolatedDeclarations`, which
// cannot infer default-export types.
const config: RstestConfig = defineConfig({
  extends: withDefaultConfig({ rootPath: root }),
  root,
  name: 'use-sync-external-store',
  include: ['test/**/*.test.{js,jsx,ts,tsx}'],
});

export default config;
