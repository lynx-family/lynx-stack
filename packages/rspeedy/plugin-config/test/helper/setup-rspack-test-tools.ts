// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// `@lynx-js/test-tools` builds on `@rspack/test-tools`, which reads a set of
// `__*__` paths from *globals* at barrel-load time (e.g.
// `helper/expect/placeholder.js`). Its own runner sets these from
// `process.env.*` inside `@rspack/test-tools/setup-env`, but only when
// `process.env.RSTEST` is set. We run under vitest, so set the env (and the
// globals directly, as a belt-and-suspenders) here in a `setupFile`, which
// vitest evaluates before the test module imports `@lynx-js/test-tools`.
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const testDir = path.resolve(__dirname, '..')
const packageRoot = path.resolve(testDir, '..')
const rspackTestToolsRoot = path.dirname(
  require.resolve('@rspack/test-tools/package.json'),
)
const rspackCoreRoot = path.dirname(
  require.resolve('@rspack/core/package.json'),
)

const paths: Record<string, string> = {
  __TEST_PATH__: testDir,
  __TEST_FIXTURES_PATH__: path.join(testDir, 'cases'),
  __TEST_DIST_PATH__: path.join(testDir, 'dist'),
  __ROOT_PATH__: packageRoot,
  __RSPACK_PATH__: rspackCoreRoot,
  __RSPACK_TEST_TOOLS_PATH__: rspackTestToolsRoot,
}

const env = process.env as Record<string, string>
env['RSPACK_HOT_TEST'] ??= 'true'
env['RSTEST'] ??= 'true'
for (const [key, value] of Object.entries(paths)) {
  env[key] ??= value
}

const globals = globalThis as unknown as Record<string, unknown>
for (const [key, value] of Object.entries(paths)) {
  globals[key] ??= value
}
globals['__DEBUG__'] ??= false
globals['printLogger'] ??= process.argv.includes('--verbose')
// `@rspack/test-tools`' `BasicCaseCreator` references a bare `rstest` global
// (its native runner is `@rstest/core`). We run under vitest, where that global
// is absent; alias it to an empty object. It is only stored and spread into the
// module scope, never invoked here.
globals['rstest'] ??= {}

// Forwards the env vars above onto globals. Kept as `require` (not a top-level
// `import`): this side-effecting module reads the `process.env.*`/globals set
// above at eval time, and an ESM `import` would hoist above that setup.
// eslint-disable-next-line import/no-commonjs
require('@rspack/test-tools/setup-env')
// Register ONLY the file-snapshot matcher the harness needs. We deliberately do
// NOT pull in `@rspack/test-tools/setup-expect`, because it also installs global
// snapshot *serializers* that rewrite Error/object output and corrupt unrelated
// unit tests' inline snapshots. The harness already normalizes its own snapshot
// content via `normalizePlaceholder`, so those serializers are unnecessary here.
// Kept as `require` for the same ordering reason as above.
// eslint-disable-next-line import/no-commonjs
const { toMatchFileSnapshotSync } = require(
  '@rspack/test-tools/helper/expect/to-match-file-snapshot',
) as { toMatchFileSnapshotSync: unknown }

const globalExpect = (globalThis as unknown as {
  expect: { extend: (m: Record<string, unknown>) => void }
}).expect
globalExpect.extend({ toMatchFileSnapshotSync })
