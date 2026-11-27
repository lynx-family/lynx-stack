// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { existsSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

import { coverageDir, coverageFilePrefix } from './paths.js';

/** Removes the coverage files of an earlier run of this package. */
export default function globalSetup(): void {
  if (!existsSync(coverageDir)) {
    return;
  }
  for (const name of readdirSync(coverageDir)) {
    if (name.startsWith(coverageFilePrefix)) {
      rmSync(path.join(coverageDir, name));
    }
  }
}
