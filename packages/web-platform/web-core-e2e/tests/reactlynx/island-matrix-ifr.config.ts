// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { glob } from 'node:fs/promises';
import path from 'node:path';

import { mergeRspeedyConfig, type Config } from '@lynx-js/rspeedy';

import { commonConfig } from './commonConfig.js';

/**
 * One half of the island permutation matrix: every case in
 * `island-matrix/` built with `experimental_enableMTSRendering: true` (the classic dual-thread build).
 *
 * The two halves are separate builds because the switch is a build-wide
 * decision, and the whole point of the matrix is to hold the *source* fixed
 * and vary the switch. Entry names carry the suffix so both land in one
 * `dist` and the E2E harness can ask for either by casename.
 */
const cases = await Array.fromAsync(glob(
  [path.join(import.meta.dirname, 'island-matrix', '*', 'index.jsx')],
));

const config: Config = mergeRspeedyConfig(
  commonConfig({ experimental_enableMTSRendering: true }),
  {
    source: {
      entry: Object.fromEntries(cases.map((entry) => [
        `island-${path.basename(path.dirname(entry))}-ifr`,
        { import: entry, publicPath: '/dist/' },
      ])),
    },
  },
);

export default config;
