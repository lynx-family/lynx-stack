// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import '@lynx-js/react/debug'
import { root, useEffect, useState } from '@lynx-js/react'

declare global {
  var __PASSIVE_LOOP_COUNT__: number | undefined
}

function Counter() {
  const [count, setCount] = useState(0)
  globalThis.__PASSIVE_LOOP_COUNT__ = count

  useEffect(() => {
    if (count < 100) {
      setCount(count + 1)
    }
  }, [count])

  return <text>{count}</text>
}

export function App() {
  return <Counter />
}

root.render(<App />)
