// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineConfig } from '@rstest/core';
import type { RstestConfig } from '@rstest/core';

const reporters: RstestConfig['reporters'] = process.env.GITHUB_ACTIONS
    || process.env.GITHUB_STEP_SUMMARY
  ? [
    'default',
    ['github-actions', { annotations: false, summary: true }],
    ['junit', { outputPath: './test-report.junit.xml' }],
  ]
  : ['default'];

export default defineConfig({
  coverage: {
    reporters: ['json', 'text'],
  },
  reporters,
  projects: [
    'packages/genui/a2ui/rstest.config.ts',
    'packages/genui/a2ui-catalog-extractor/rstest.config.ts',
    'packages/genui/cli/rstest.config.ts',
    'packages/rspeedy/*/rstest.config.ts',
    'packages/web-platform/*/rstest.config.ts',
    'packages/webpack/*/rstest.config.ts',
    'examples/react-debug-metadata/error-remapping/rstest.config.ts',
  ],
});
