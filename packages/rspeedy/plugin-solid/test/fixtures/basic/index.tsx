// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createSignal, For, root, Show } from '@lynx-js/solid'

function Value(props: { count: () => number }) {
  return <text>{props.count()}</text>
}

function App() {
  const [count, setCount] = createSignal(0)

  return (
    <view class='counter' bindtap={() => setCount(value => value + 1)}>
      <text>{count()}</text>
      <Show when={true}>
        <For each={[count]}>
          {value => <Value count={value} />}
        </For>
      </Show>
    </view>
  )
}

root.render(App)
