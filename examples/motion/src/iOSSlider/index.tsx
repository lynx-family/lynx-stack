import {
  animate,
  progress as calcProgress,
  clamp,
  mapValue,
  mix,
  styleEffect,
  transformValue,
  useMotionValueRef,
} from '@lynx-js/motion-lynx';
import { runOnMainThread, useEffect, useMainThreadRef } from '@lynx-js/react';
import type { MainThread } from '@lynx-js/types';

import SunPng from './sun.png';

import './styles.css';

/**
 * ==============   Configuration   ================
 */
const maxPull = 20;
const maxSquish = 0.92;
const maxStretch = 1.08;

export default function Comp() {
  /**
   * ==============   State   ================
   */
  const sliderRef = useMainThreadRef<MainThread.Element>(null);
  const progressRef = useMotionValueRef(0.5);
  const sizeRef = useMainThreadRef({ top: 0, bottom: 0 });
  const initialDragYRef = useMainThreadRef(0);
  const initialProgressYRef = useMainThreadRef(0);

  function measureSlider() {
    'main thread';
    void sliderRef.current?.invoke('boundingClientRect').then(
      (res: { top: number; bottom: number }) => {
        sizeRef.current = { top: res.top, bottom: res.bottom };
      },
    );
  }

  function initEffects() {
    'main thread';
    measureSlider();

    const y = mapValue(progressRef.current, [-1, 0, 1, 2], [
      maxPull,
      0,
      0,
      -maxPull,
    ]);
    const scaleX = mapValue(
      y,
      [-maxPull, 0, 0, maxPull],
      [maxSquish, 1, 1, maxSquish],
    );
    const scaleY = mapValue(
      y,
      [-maxPull, 0, 0, maxPull],
      [maxStretch, 1, 1, maxStretch],
    );

    styleEffect('.slider', { y, scaleX, scaleY });

    styleEffect('.indicator', {
      scaleY: transformValue(() => clamp(0, 1, progressRef.current.get())),
    });

    const invertScaleX = transformValue(() => 1 / scaleX.get());
    const invertScaleY = transformValue(() => 1 / scaleY.get());
    styleEffect('.icon-container', {
      scaleX: invertScaleX,
      scaleY: invertScaleY,
    });
  }

  useEffect(() => {
    void runOnMainThread(initEffects)();
  }, []);

  function onTouchStart(e: MainThread.TouchEvent) {
    'main thread';
    progressRef.current.stop();

    initialDragYRef.current = e.detail.y;
    initialProgressYRef.current = mix(
      sizeRef.current.bottom,
      sizeRef.current.top,
      progressRef.current.get(),
    );
  }

  function onTouchMove(e: MainThread.TouchEvent) {
    'main thread';

    const dragOffset = e.detail.y - initialDragYRef.current;
    const newProgressY = initialProgressYRef.current + dragOffset;

    progressRef.current.set(
      calcProgress(sizeRef.current.bottom, sizeRef.current.top, newProgressY),
    );
  }

  function onTouchEnd(_e: MainThread.TouchEvent) {
    'main thread';
    // Animate back to bounds if needed
    if (progressRef.current.get() < 0) {
      animate(progressRef.current, 0, {
        type: 'spring',
        stiffness: 200,
        damping: 60,
      });
    } else if (progressRef.current.get() > 1) {
      animate(progressRef.current, 1, {
        type: 'spring',
        stiffness: 200,
        damping: 60,
      });
    }
  }

  return (
    <view className='case-container'>
      <view
        className='slider'
        main-thread:ref={sliderRef}
        main-thread:bindtouchstart={onTouchStart}
        main-thread:bindtouchmove={onTouchMove}
        main-thread:bindtouchend={onTouchEnd}
      >
        <view className='indicator'></view>
        <view className='icon-container'>
          <image className='icon' src={SunPng} />
        </view>
      </view>
    </view>
  );
}
