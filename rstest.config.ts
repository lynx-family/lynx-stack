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
    reporters: ['lcov', 'text'],
    // `web-elements`' built output cannot be instrumented: doing so aborts
    // coverage reporting for the entire run.
    //
    // TypeScript lowers its `@Component`-decorated custom elements into a
    // class `static {}` block whose statements have no original source
    // position, so the emitted `.js.map` maps them to line 0.
    // `istanbul-lib-source-maps` lets a `line: 0` entry through
    // (`isInvalidPosition` only rejects `line < 0`) and hands it to
    // `@jridgewell/trace-mapping`, which throws "`line` must be greater than
    // 0". A single such mapping kills report generation for the whole run and
    // exits non-zero *after* every test has already passed — a green test list
    // with a red `test-rstest` job and no Codecov upload.
    //
    // This output is never imported by a test directly; it is pulled in
    // transitively, because a module under test imports
    // `@lynx-js/web-elements/all` at module scope.
    //
    // Deliberately scoped to `web-elements/dist` — do NOT broaden this to
    // `**/dist/**`. Other workspace packages are also consumed as built
    // output, but theirs carries valid source maps that remap back to tracked
    // `src/**`, so those rows land in the report under their real source
    // paths. Excluding them happens *before* that remapping and silently
    // drops ~12 files of genuine source coverage (`css-serializer/src/**`,
    // `debug-metadata/src/**`, `web-worker-rpc/src/**`), which would show up
    // as an unexplained Codecov drop rather than an error.
    //
    // Must live in the root config: `coverage.exclude` set inside an
    // individual project config is ignored when projects run under this root
    // config, which is how CI invokes rstest.
    exclude: ['**/web-elements/dist/**'],
  },
  reporters,
  projects: [
    'examples/react-debug-metadata/error-remapping/rstest.config.ts',
    'packages/genui/a2ui/rstest.config.ts',
    'packages/genui/a2ui-catalog-extractor/rstest.config.ts',
    'packages/genui/cli/rstest.config.ts',
    'packages/genui/lynx-xml/rstest.config.ts',
    'packages/genui/mcp-apps/rstest.config.ts',
    'packages/genui/openui/rstest.config.ts',
    'packages/genui/playground/rstest.config.ts',
    'packages/genui/server/rstest.config.ts',
    'packages/i18n/*/rstest.config.ts',
    'packages/lynx/*/rstest.config.ts',
    'packages/motion/rstest.config.ts',
    // Only `runtime` and `transform`, not the `packages/react/*` glob: that
    // would also sweep in `react/testing-library`'s own suite, which cannot
    // join this aggregator (see the note below).
    'packages/react/runtime/rstest.config.ts',
    'packages/react/transform/rstest.config.ts',
    'packages/rspeedy/*/rstest.config.ts',
    'packages/tailwind-preset/rstest.config.ts',
    // `kitten-lynx` is deliberately absent: it drives a real Android
    // emulator and runs in its own CI job.
    'packages/testing-library/testing-environment/rstest.config.ts',
    'packages/testing-library/examples/library/rstest.config.ts',
    // `react/testing-library` (both engine variants), `testing-library/
    // examples/basic`, and `testing-library/examples/react-compiler` (both
    // variants) are deliberately absent. Each wires `@lynx-js/react-rsbuild-
    // plugin`'s alias resolution (directly, or through `withLynxConfig`,
    // which uses it too) — via `pluginReactLynx()` or the app's own
    // `lynx.config.ts`. That plugin cannot find `@lynx-js/react` when Rstest
    // runs it as one entry of a `projects` list: `Cannot find module
    // '@lynx-js/react/jsx-runtime'`, reproducible even with a single such
    // project wrapped in `projects: [...]` and gone the moment the same
    // config runs as a standalone `-c <path>` invocation. They run standalone
    // in CI instead (`test-react` job), matching how this repo already runs
    // `react/runtime` and `react/transform` next to, not inside, this
    // aggregator.
    'packages/tools/*/rstest.config.ts',
    'packages/use-sync-external-store/rstest.config.ts',
    'packages/web-platform/*/rstest.config.ts',
    'packages/webpack/*/rstest.config.ts',
  ],
});
