// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const packageDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

/** The fixture project. */
export const fixtureDir = path.join(packageDir, 'fixtures/two-cards');

/** Where the global setup builds the fixture for the static tests. */
export const staticFixtureDir = path.join(packageDir, 'dist/e2e-fixture');

/** The substitute bundler workers. */
export const workersDir = path.join(packageDir, 'tests/e2e/workers');

/**
 * Where the coverage fixture writes istanbul files: the directory that the
 * fixture of `@lynx-js/playwright-fixtures` writes to, which `nyc report`
 * reads with `--cwd=packages/web-platform`.
 */
export const coverageDir = path.join(packageDir, '..', '.nyc_output');

/** The prefix of this package's files in {@link coverageDir}. */
export const coverageFilePrefix = 'web-preview-kit_';
