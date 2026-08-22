// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';

/**
 * The documented main-thread mutate-then-flush pattern: a `main-thread:bind*`
 * handler writes to the element tree and calls `__FlushElementTree()` inline,
 * while the dispatcher that invoked it is still on the stack. It is reached
 * through `globalThis` because the worklet transform captures any other bare
 * identifier as a closure variable, evaluated on the background thread.
 *
 * The child flushes first. The parent's bubble handler runs only if that flush
 * returned normally - a throw from inside the flush unwinds through the
 * dispatcher's own frames, so it is reported as an uncaught page error and
 * every handler ordered after it is skipped.
 *
 * @see https://github.com/lynx-family/lynx-stack/issues/3395
 */
function App() {
  const onChildTap = (event) => {
    'main thread';
    event.currentTarget.setStyleProperty('background-color', 'green');
    globalThis.__FlushElementTree();
  };
  const onParentTap = (event) => {
    'main thread';
    event.currentTarget.setStyleProperty('background-color', 'blue');
    globalThis.__FlushElementTree();
  };
  return (
    <view
      id='parent'
      main-thread:bindtap={onParentTap}
      style={{
        height: '200px',
        width: '200px',
        background: 'pink',
      }}
    >
      <view
        id='child'
        main-thread:bindtap={onChildTap}
        style={{
          height: '100px',
          width: '100px',
          background: 'pink',
        }}
      />
    </view>
  );
}
root.render(<App />);
