// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineConfig } from '@rstest/core';

const reporters = process.env.GITHUB_ACTIONS || process.env.GITHUB_STEP_SUMMARY
  ? [
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
    'packages/genui/ui-judge/rstest.config.ts',
    'packages/i18n/*/rstest.config.ts',
    // Only node-env packages are aggregated here. The ReactLynx-DOM suites
    // (gesture-runtime, the testing-library family, react/runtime, motion,
    // use-sync) are NOT: when rstest loads every project from the repo-root
    // context it cannot resolve their per-package `@lynx-js/react/*` (`src` +
    // jsx-runtime) aliases that `withDefaultConfig` sets up. They run
    // per-package instead, in the `test-rstest` job's second command
    // (`pnpm --filter … run test`). That is also why `lynx/*` is listed
    // explicitly below rather than as a glob — a glob would pull in the DOM
    // package `gesture-runtime` and break the aggregate.
    'packages/lynx/autolink-codegen/rstest.config.ts',
    'packages/lynx/create-lynx-library/rstest.config.ts',
    'packages/react/transform/rstest.config.ts',
    'packages/rspeedy/*/rstest.config.ts',
    'packages/tailwind-preset/rstest.config.ts',
    'packages/tools/*/rstest.config.ts',
    'packages/web-platform/*/rstest.config.ts',
    'packages/webpack/*/rstest.config.ts',
  ],
});
