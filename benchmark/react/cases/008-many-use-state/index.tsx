// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { root, useState } from '@lynx-js/react';

import { RunBenchmarkUntilHydrate } from '../../src/RunBenchmarkUntil.js';

function Item() {
  const [counter] = useState(0);
  return counter === 1 ? <text>{counter}</text> : null;
}
function App() {
  return (
    <view>
      {Array.from({
        length: 1000,
      }).map(() => {
        return <Item />;
      })}
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
