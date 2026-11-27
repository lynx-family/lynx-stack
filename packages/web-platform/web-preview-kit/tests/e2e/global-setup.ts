// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

import {
  coverageDir,
  coverageFilePrefix,
  packageDir,
  staticFixtureDir,
} from './paths.js';

/**
 * Checks the kit is built, builds the fixture once for the static tests, and
 * removes the coverage files of an earlier run of this package.
 */
export default function globalSetup(): void {
  if (!existsSync(path.join(packageDir, 'dist/kit/index.html'))) {
    throw new Error(
      'The kit is not built. Run `pnpm turbo build --filter=@lynx-js/web-preview-kit` first.',
    );
  }
  const result = spawnSync(
    process.execPath,
    [path.join(packageDir, 'tests/node/build-fixture.mjs'), staticFixtureDir],
    { cwd: packageDir, stdio: 'inherit' },
  );
  if (result.status !== 0) {
    throw new Error('Building the fixture failed.');
  }
  if (existsSync(coverageDir)) {
    for (const name of readdirSync(coverageDir)) {
      if (name.startsWith(coverageFilePrefix)) {
        rmSync(path.join(coverageDir, name));
      }
    }
  }
}
