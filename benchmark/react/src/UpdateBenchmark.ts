// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { useEffect, useState } from '@lynx-js/react';

import { PREFIX } from './hook.js';

export function startUpdateBenchmark(): void {
  if (typeof Codspeed !== 'undefined') {
    Codspeed.startBenchmark();
  }
}

function getUpdateBenchmarkName(caseFilePath: string): string {
  const pathSegments = caseFilePath.split('/');
  const caseName = pathSegments[pathSegments.length - 2] ?? caseFilePath;
  return `${PREFIX}::${caseName}_Update`;
}

export function useUpdateBenchmarkCompletion(
  caseFilePath: string,
  updated: boolean,
): boolean {
  const [benchmarkFinished, setBenchmarkFinished] = useState(false);

  useEffect(() => {
    if (!updated) {
      return;
    }

    if (typeof Codspeed !== 'undefined') {
      Codspeed.stopBenchmark();
      Codspeed.setExecutedBenchmark(
        getUpdateBenchmarkName(caseFilePath),
      );
    }
    setBenchmarkFinished(true);
  }, [caseFilePath, updated]);

  return benchmarkFinished;
}
