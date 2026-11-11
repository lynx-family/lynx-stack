// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { lazy, root, Suspense } from '@lynx-js/react'

const LazyBundleComp = lazy(() => import('./lazy-bundle-comp.jsx'))

function App() {
  const onTap = () => {
    'main thread'
  }

  return (
    <view bindtap={onTap}>
      <text>release-order</text>
      <Suspense fallback={<text>loading</text>}>
        <LazyBundleComp />
      </Suspense>
    </view>
  )
}

root.render(
  <page>
    <App />
  </page>,
)
