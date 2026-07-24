// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { root } from '@lynx-js/react';

import { RunBenchmarkUntilHydrate } from '../../src/RunBenchmarkUntil.js';

const ELEMENT_COUNT = 100;

const ATTRIBUTES = {
  textMaxline: '2',
  textMaxlength: '128',
  enableFontScaling: false,
  textVerticalAlign: 'center',
  tailColorConvert: false,
  includeFontPadding: false,
  textFakeBold: false,
  textSelection: false,
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
