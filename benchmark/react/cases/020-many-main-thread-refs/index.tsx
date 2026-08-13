// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { root, useMainThreadRef } from '@lynx-js/react';

import { RunBenchmarkUntilHydrate } from '../../src/RunBenchmarkUntil.js';

function Item({ index }: { index: number }) {
  const value = useMainThreadRef(index);
  const increment = () => {
    'main thread';
    value.current++;
  };

  return (
    <view
      main-thread:bindtap={increment}
      style={{ height: '1px', width: '1px' }}
    />
  );
}

function App() {
  return (
    <view>
      {Array.from(
        { length: 1000 },
        (_, index) => <Item index={index} key={index} />,
      )}
    </view>
  );
}

runAfterLoadScript(() => {
  root.render(
    <>
      <App />
      <RunBenchmarkUntilHydrate />
    </>,
  );
});
