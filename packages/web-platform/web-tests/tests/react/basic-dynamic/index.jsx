// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, lazy, Suspense } from '@lynx-js/react';
import '@lynx-js/react/experimental/lazy/import';

const importPath =
  `http://localhost:${process.env.PORT}/dist/config-dynamic-component/index.web.json`;
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
      <Suspense fallback={<text>Loading...</text>}>
        <LazyComponent />
      </Suspense>
    </view>
  );
}

root.render(<App></App>);
