// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useState, root, lazy, Suspense } from '@lynx-js/react';

const importPath = `/dist/config-lazy-component-bindtap/index.web.json`;
const LazyComponent = lazy(
  () =>
    import(
      importPath,
      {
        with: { type: 'component' },
      }
    ),
);

export function App() {
  const [shouldDisplay, setShouldDisplay] = useState(false);
  const handleClick = () => {
    setShouldDisplay(true);
  };
  return (
    <view>
      <view
        bindtap={handleClick}
        id='target'
        style={{ width: '100px', height: '100px', backgroundColor: 'red' }}
      >
        Load Component
      </view>
      {shouldDisplay && (
        <Suspense fallback={<text>Loading...</text>}>
          <LazyComponent />
        </Suspense>
      )}
    </view>
  );
}

root.render(<App></App>);
