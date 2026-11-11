// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ReactNode } from '@lynx-js/react';
import './styles.css';

export function FeaturePage(
  { name, results, children }: {
    name: string;
    results: string[];
    children: ReactNode;
  },
) {
  const passed = results.filter(result => result.startsWith('PASS ')).length;
  return (
    <view className='feature-page'>
      <text className='feature-summary'>
        {name}:{' '}
        {results.length > 0 ? `${passed}/${results.length} passed` : 'running'}
      </text>
      <view className='feature-targets'>{children}</view>
      {results.map(result => (
        <text className='feature-result' key={result}>{result}</text>
      ))}
    </view>
  );
}
