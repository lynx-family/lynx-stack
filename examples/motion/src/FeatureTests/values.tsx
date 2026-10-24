// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { mix, springValue } from '@lynx-js/motion';
import type { MotionValue } from '@lynx-js/motion';
import {
  root,
  runOnMainThread,
  useEffect,
  useMainThreadRef,
  useMemo,
} from '@lynx-js/react';
import type { MainThread } from '@lynx-js/types';

export default function ValuesExample() {
  const box = useMainThreadRef<MainThread.Element>(null);
  const value = useMainThreadRef<MotionValue<number> | null>(null);

  // Temporary reachability anchor: keep Motion's implementation module in the
  // main-thread graph even though the animation below starts in useEffect.
  // This references the worklet descriptor without calling it during render.
  // Remove after https://github.com/lynx-family/lynx-stack/issues/4244 is fixed.
  useMemo(() => springValue, []);

  useEffect(() => {
    function start() {
      'main thread';
      const animation = springValue<number>(0, { duration: 0.1, bounce: 0 });
      value.current = animation;
      animation.on('change', next => {
        box.current?.setStyleProperty('height', `${mix(100, 200, next)}px`);
      });
      animation.set(1);
    }

    function stop() {
      'main thread';
      value.current?.destroy();
      value.current = null;
    }

    void runOnMainThread(start)();
    return () => {
      void runOnMainThread(stop)();
    };
  }, [box, value]);

  return (
    <view>
      <text>Effect-started springValue and mix</text>
      <text>The box animates from 100px to 200px high.</text>
      <view
        id='value-box'
        main-thread:ref={box}
        style={{ width: '100px', height: '100px', backgroundColor: 'red' }}
      />
    </view>
  );
}

root.render(<ValuesExample />);
