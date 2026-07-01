// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* eslint-disable n/no-process-exit */

/**
 * Compare a current WPT baseline against a previous one (e.g. from main)
 * and fail if any directory's pass rate drops more than 0.5% OR if the
 * overall pass rate drops at all. See Shim_Implementation_PRD.md US-464.
 */

import { readFileSync } from 'node:fs';

const currentPath = process.argv[2];
const previousPath = process.argv[3];
if (!currentPath || !previousPath) {
  console.error(
    'usage: check-wpt-no-regression.mjs <current.json> <previous.json>',
  );
  process.exit(2);
}

const current = JSON.parse(readFileSync(currentPath, 'utf8'));
const previous = JSON.parse(readFileSync(previousPath, 'utf8'));
const ALLOWED_DROP = 0.005;

if (current.overallPassRate < previous.overallPassRate) {
  console.error(
    'REGRESSION: overall pass rate dropped from '
      + previous.overallPassRate.toFixed(3)
      + ' to '
      + current.overallPassRate.toFixed(3),
  );
  process.exit(1);
}

const prevDirs = new Map(
  previous.directories.map((d) => [d.path, d.passRate]),
);
let failed = false;
for (const dir of current.directories) {
  const prevRate = prevDirs.get(dir.path) ?? 0;
  if (dir.passRate < prevRate - ALLOWED_DROP) {
    console.error(
      'REGRESSION: '
        + dir.path
        + ' pass rate dropped from '
        + prevRate.toFixed(3)
        + ' to '
        + dir.passRate.toFixed(3),
    );
    failed = true;
  }
}
if (failed) process.exit(1);

process.stdout.write('NO_REGRESSION\n');
