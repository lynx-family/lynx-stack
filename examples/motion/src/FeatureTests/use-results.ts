// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useState } from '@lynx-js/react';

export function useResults(): [string[], (results: string[]) => void] {
  const [results, setResults] = useState<string[]>([]);
  return [results, (next) => {
    console.info('MOTION_FEATURE_RESULTS', JSON.stringify(next));
    setResults(next);
  }];
}
