// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Deferred, Island } from './parts.jsx';

/**
 * The same island, marked at its definition instead of reached through a
 * `<MainThread>`. The marker puts this module in the main-thread bundle; it
 * says nothing about *where* the island sits, which is the distinction `p11`
 * is built to show.
 */
export function MarkedIsland({ id }) {
  'main thread component';
  return <Island id={id} />;
}

/** `DeferredWithIsland`, with the marker in place of the boundary. */
export function DeferredWithMarkedIsland({ id }) {
  return (
    <view style={{ display: 'flex', flexDirection: 'column' }}>
      <Deferred id={id} />
      <MarkedIsland id={`${id}-inner`} />
    </view>
  );
}
