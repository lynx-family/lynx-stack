// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react'

import { total } from '../mts-rendering-shared/physics.js' with {
  runtime: 'shared',
}

function App(): JSX.Element {
  function onTap() {
    'main thread'
    total()
  }
  return <view main-thread:bindtap={onTap}>second-entry-only</view>
}

root.render(
  <page>
    <App />
  </page>,
)
