// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, lazy, Suspense } from '@lynx-js/react';

const importPath = `/dist/config-lazy-component-bindtap/index.web.json`;
const LazyComponent = lazy(
  () => {
    return import(
      importPath,
      {
        with: { type: 'component' },
      }
    );
  },
);

const importPath2 = `/dist/config-lazy-component-bindtap/index.web.json`;
const LazyComponent2 = lazy(
  () => {
    return import(
      importPath2,
      {
        with: { type: 'component' },
      }
    );
  },
);

export default function App() {
  return (
    <Suspense>
      <LazyComponent />
      <LazyComponent2 />
    </Suspense>
  );
}

root.render(<App></App>);
