// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useState, root, useRef, useCallback } from '@lynx-js/react';
function App() {
  const [text, setState] = useState('');
  const raf = useRef();
  const loop = useCallback(() => {
    setState('loop');
    raf.current = lynx.requestAnimationFrame(loop);
  }, []);
  const stop = useCallback(() => {
    lynx.cancelAnimationFrame(raf.current);
    setState('stop');
  }, []);
  const start = useCallback(() => {
    raf.current = lynx.requestAnimationFrame(loop);
  }, []);
  return (
    <view>
      <view>
        <text>{text}</text>
      </view>
      <view id='stop' bindtap={stop}>
        <text>cancelAnimationFrame</text>
      </view>
      <view id='start' bindtap={start}>
        <text>requestAnimationFrame</text>
      </view>
    </view>
  );
}
root.render(<App />);
