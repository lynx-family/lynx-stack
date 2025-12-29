// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { useEffect, useState } from '@lynx-js/react';

export const RunBenchmarkUntilHydrate = () => {
  return <view id={`stop-benchmark-${__BACKGROUND__}`} />;
};

export const RunBenchmarkUntilEffect = () => {
  const [stopBenchmark, setStopBenchmark] = useState(false);
  useEffect(() => {
    setStopBenchmark(true);
  }, []);
  return <view id={`stop-benchmark-${stopBenchmark}`} />;
};
