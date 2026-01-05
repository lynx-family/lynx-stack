// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, lazy, Suspense } from '@lynx-js/react';
import './index.css';

const importPath = `/dist/config-lazy-component-css.web.bundle`;
const LazyComponent = lazy(
  () =>
    import(
      importPath,
      {
        with: { type: 'component' },
      }
    ),
);
const importPath2 = `/dist/config-lazy-component-css-other.web.bundle`;
const LazyComponent2 = lazy(
  () =>
    import(
      importPath2,
      {
        with: { type: 'component' },
      }
    ),
);

export default function App() {
  return (
    <view>
      <view class='container'></view>
      <Suspense fallback={<text id='fallback'>Loading...</text>}>
        <LazyComponent />
        <LazyComponent2 />
      </Suspense>
    </view>
  );
}

root.render(<App></App>);
