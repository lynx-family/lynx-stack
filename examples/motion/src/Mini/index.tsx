import {
  animate,
  useMotionValueRef,
  useMotionValueRefEvent,
} from '@lynx-js/motion/mini';
import { root, runOnMainThread, useMainThreadRef } from '@lynx-js/react';
import type { MainThread } from '@lynx-js/types';

import './styles.css';

import '@lynx-js/preact-devtools';
import '@lynx-js/react/debug';

export default function MiniExample() {
  const boxRef = useMainThreadRef<MainThread.Element>(null);
  const x = useMotionValueRef(0);
  const scale = useMotionValueRef(1);

  // Consolidate transform updates to avoid redundant DOM operations
  const updateTransform = (xVal?: number, scaleVal?: number) => {
    'main thread';
    const xValue = xVal ?? x.current.get();
    const scaleValue = scaleVal ?? scale.current.get();
    boxRef.current?.setStyleProperties({
      transform: `translateX(${xValue}px) scale(${scaleValue})`,
    });
  };

  useMotionValueRefEvent(x, 'change', (v) => {
    'main thread';
    updateTransform(v, undefined);
  });

  useMotionValueRefEvent(scale, 'change', (v) => {
    'main thread';
    updateTransform(undefined, v);
  });

  const handleTapSpring = () => {
    void runOnMainThread(startSpring)();
  };

  const handleTapScale = () => {
    void runOnMainThread(startScale)();
  };

  function startSpring() {
    'main thread';
    const target = x.current.get() === 0 ? 200 : 0;
    animate(x.current, target, {
      type: 'spring',
      stiffness: 200,
      damping: 20,
    });
  }

  function startScale() {
    'main thread';
    const target = scale.current.get() === 1 ? 1.5 : 1;
    animate(scale.current, target, {
      duration: 0.4,
      ease: t => t,
    });
  }

  return (
    <view className='mini-container'>
      <view main-thread:ref={boxRef} className='mini-box' />
      <view className='mini-controls'>
        <view className='mini-btn' bindtap={handleTapSpring}>
          <text>Spring Move</text>
        </view>
        <view className='mini-btn' bindtap={handleTapScale}>
          <text>Scale BackOut</text>
        </view>
      </view>
    </view>
  );
}

root.render(
  <MiniExample />,
);

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept();
}
