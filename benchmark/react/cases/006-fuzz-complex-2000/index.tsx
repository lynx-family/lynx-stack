// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { root, useEffect, useState } from '@lynx-js/react';
import { process } from '@lynx-js/react/internal';

import { genRandom, genValue } from '../../plugins/gen.js';

const F = __GENERATE_JSX__(0, 2000)({ useState }, genRandom, genValue);

function App() {
  const [stopBenchmark, setStopBenchmark] = useState(false);
  const [seed, setSeed] = useState(100);
  useEffect(() => {
    setTimeout(() => {
      setSeed(101);
      setStopBenchmark(true);
      Codspeed.startBenchmark();
      process();
      Codspeed.stopBenchmark();
      Codspeed.setExecutedBenchmark(
        `${__REPO_FILEPATH__}::${__webpack_chunkname__}-preactProcess`,
      );
    }, 0);
  }, []);
  return (
    <>
      <F seed={seed} />
      <view id={`stop-benchmark-${stopBenchmark}`} />
    </>
  );
}

runAfterLoadScript(() => {
  root.render(
    <App />,
  );
});
