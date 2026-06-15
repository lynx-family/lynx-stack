// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* eslint-disable n/no-process-exit */

/**
 * Print the Ralph completion-promise gate result for the WPT subset.
 * Per Shim_Implementation_PRD.md §12.4 US-465:
 *
 *   node scripts/ralph-shim/check-wpt-gate.mjs packages/dom-shim/wpt/baseline.json
 *
 * Prints either:
 *   WPT_SUBSET_70PCT_PASS
 *   WPT_SUBSET_BELOW_GATE: 0.XX
 */

import { readFileSync } from 'node:fs';

const path = process.argv[2];
if (!path) {
  console.error('usage: check-wpt-gate.mjs <result.json>');
  process.exit(2);
}

const data = JSON.parse(readFileSync(path, 'utf8'));
const passRate = data.overallPassRate;
const gate = data.gateThreshold ?? 0.7;

if (typeof passRate !== 'number') {
  console.error('invalid result file: overallPassRate missing');
  process.exit(2);
}

if (passRate >= gate) {
  process.stdout.write('WPT_SUBSET_70PCT_PASS\n');
} else {
  process.stdout.write('WPT_SUBSET_BELOW_GATE: ' + passRate.toFixed(2) + '\n');
  process.exit(1);
}
