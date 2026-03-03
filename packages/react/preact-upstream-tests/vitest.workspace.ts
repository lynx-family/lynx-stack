// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineWorkspace } from 'vitest/config';

// Run the same Preact upstream tests in two modes:
//   1. No compiler   — Preact sees raw props, tests reconciler semantics
//   2. With compiler — SWC transforms JSX to snapshots, tests that the
//                      compiler optimization doesn't change output semantics
//
// Both modes should produce identical DOM output. Discrepancies = bugs.
export default defineWorkspace([
  'vitest.config.ts',
  'vitest.compiled.config.ts',
]);
