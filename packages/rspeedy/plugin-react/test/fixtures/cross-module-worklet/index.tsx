// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  root,
  runOnMainThread,
  useEffect,
  useMainThreadRef,
} from '@lynx-js/react'

import { spin } from './spin.js'

function App() {
  const boxRef = useMainThreadRef<unknown>(null)

  useEffect(() => {
    runOnMainThread(() => {
      'main thread'
      if (boxRef.current) {
        spin(boxRef.current, 45)
      }
    })()
  }, [])

  return <view main-thread:ref={boxRef} />
}

root.render(
  <page>
    <App />
  </page>,
)
