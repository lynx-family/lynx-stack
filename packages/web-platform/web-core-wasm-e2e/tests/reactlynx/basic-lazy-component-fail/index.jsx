// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, lazy, Suspense } from '@lynx-js/react';

// nonexistent url
const importPath = `/dist/nonexistent.web.bundle`;
const LazyComponent = lazy(
  () =>
    import(
      importPath,
      {
        with: { type: 'component' },
      }
    ),
);

export default function App() {
  return (
    <view>
      <Suspense fallback={<text id='fallback'>Loading...</text>}>
        <LazyComponent />
      </Suspense>
    </view>
  );
}

root.render(<App></App>);
