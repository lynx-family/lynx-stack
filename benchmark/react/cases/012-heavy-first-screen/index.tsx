// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Baseline for 013-background-boundary: the same heavy subtree rendered
// through the regular main-thread first-screen render (IFR).

import { root } from '@lynx-js/react';

import { HeavyFeed } from '../../src/HeavyFeed.js';
import { RunBenchmarkUntilHydrate } from '../../src/RunBenchmarkUntil.js';

runAfterLoadScript(() => {
  root.render(
    <>
      <HeavyFeed />
      <RunBenchmarkUntilHydrate />
    </>,
  );
});
