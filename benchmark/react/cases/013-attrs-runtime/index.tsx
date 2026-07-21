// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { root } from '@lynx-js/react';

import { RunBenchmarkUntilHydrate } from '../../src/RunBenchmarkUntil.js';

const ELEMENT_COUNT = 100;

const ATTRIBUTES = {
  'text-maxline': '2',
  'text-maxlength': '128',
  'enable-font-scaling': false,
  'text-vertical-align': 'center',
  'tail-color-convert': false,
  'include-font-padding': false,
  'text-fake-bold': false,
  'text-selection': false,
} as const;

function App() {
  return (
    <view>
      {Array.from({ length: ELEMENT_COUNT }, () => <text {...ATTRIBUTES} />)}
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
