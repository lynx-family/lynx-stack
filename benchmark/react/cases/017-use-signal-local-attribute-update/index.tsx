// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { root, useEffect } from '@lynx-js/react';
import { useSignal } from '@lynx-js/react-signals';

import { startUpdateBenchmark } from '../../src/UpdateBenchmark.js';
import { LocalAttributeUpdateBenchmark } from '../../src/UpdateBenchmarks.js';

function App() {
  const updatedSignal = useSignal(false);

  useEffect(() => {
    startUpdateBenchmark();
    updatedSignal.value = true;
  }, [updatedSignal]);

  return (
    <LocalAttributeUpdateBenchmark
      caseFilePath={__REPO_FILEPATH__}
      readUpdated={() => updatedSignal.value}
    />
  );
}

runAfterLoadScript(() => {
  root.render(<App />);
});
