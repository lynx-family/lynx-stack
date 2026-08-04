// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { MainThread } from '@lynx-js/react';

import { Deferred, Island } from './parts.jsx';

/**
 * A deferred subtree that itself contains a `<MainThread>`.
 *
 * Kept out of `parts.jsx` so only the case that needs it names a boundary:
 * the build reads an entry's whole relative-import graph, and a boundary in
 * the shared module would make every case a boundary case.
 */
export function DeferredWithIsland({ id }) {
  return (
    <view style={{ display: 'flex', flexDirection: 'column' }}>
      <Deferred id={id} />
      <MainThread>
        <Island id={`${id}-inner`} />
      </MainThread>
    </view>
  );
}
