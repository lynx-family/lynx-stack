// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Counterpart of 012-heavy-first-screen: the same heavy subtree opts out of
// the main-thread first-screen render (IFR) through the `<Background>`
// boundary. Comparing the two traces shows the main-thread first-screen time
// saved by the boundary against the extra hydration patch it costs.

import { Background, root } from '@lynx-js/react';

import { FeedSkeleton, HeavyFeed } from '../../src/HeavyFeed.js';
import { RunBenchmarkUntilHydrate } from '../../src/RunBenchmarkUntil.js';

runAfterLoadScript(() => {
  root.render(
    <>
      <Background fallback={<FeedSkeleton />}>
        <HeavyFeed />
      </Background>
      <RunBenchmarkUntilHydrate />
    </>,
  );
});
