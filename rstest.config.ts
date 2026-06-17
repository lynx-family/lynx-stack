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
    'packages/i18n/*/rstest.config.ts',
    // ReactLynx-DOM suites (gesture-runtime, testing-library family) are NOT
    // aggregated here: rstest's root `projects` context cannot resolve their
    // per-package `@lynx-js/react/jsx-runtime` alias (applied by
    // `pluginReactLynx`). They run per-package via the `test-rstest-pkg` CI job
    // instead (the same pattern as `test-react`).
    'packages/lynx/autolink-codegen/rstest.config.ts',
    'packages/lynx/create-lynx-library/rstest.config.ts',
    'packages/rspeedy/*/rstest.config.ts',
    'packages/tailwind-preset/rstest.config.ts',
    'packages/tools/*/rstest.config.ts',
    'packages/webpack/*/rstest.config.ts',
  ],
});
