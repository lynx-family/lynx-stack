// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react'

import { bump, sharedMarker, total } from './physics.js' with {
  runtime: 'shared',
}

interface StubEvent {
  target: { setAttribute(name: string, value: unknown): void }
  step: number
}

function App(): JSX.Element {
  function onBump(e: StubEvent) {
    'main thread'
    e.target.setAttribute('total', bump(e.step))
  }
  function onRead(e: StubEvent) {
    'main thread'
    e.target.setAttribute('total', total())
    e.target.setAttribute('marker', sharedMarker)
  }
  return (
    <view main-thread:bindtap={onBump} main-thread:bindlongpress={onRead}>
      <text>shared</text>
    </view>
  )
}

root.render(
  <page>
    <App />
  </page>,
)
