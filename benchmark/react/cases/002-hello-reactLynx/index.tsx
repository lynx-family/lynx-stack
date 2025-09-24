// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { root } from '@lynx-js/react';

import RecursiveText from './RecursiveText.js';
import { RunBenchmarkUntilHydrate } from '../../src/RunBenchmarkUntil.js';

runAfterLoadScript(() => {
  root.render(
    <>
      <RecursiveText text='Hello, ReactLynx 🎉!' />
      <RunBenchmarkUntilHydrate />
    </>,
  );
});
