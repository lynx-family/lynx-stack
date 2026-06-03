// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { root } from '@lynx-js/react';

import { result } from './fixture.js';
import { RunBenchmarkUntilHydrate } from '../../src/RunBenchmarkUntil.js';

runAfterLoadScript(() => {
  root.render(
    <>
      <text>{'r=' + String(result)}</text>
      <RunBenchmarkUntilHydrate />
    </>,
  );
});
