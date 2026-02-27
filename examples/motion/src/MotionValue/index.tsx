import { motionValue } from '@lynx-js/motion';
import type { MotionValue } from '@lynx-js/motion';
import { runOnMainThread, useEffect, useMainThreadRef } from '@lynx-js/react';
import type { MainThread } from '@lynx-js/types';

import './styles.css';

export default function Basic() {
  const boxMTRef = useMainThreadRef<MainThread.Element>(null);
  const valueMTRef = useMainThreadRef<MotionValue<number>>();
  const intervalMTRef = useMainThreadRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const unsubscribeMTRef = useMainThreadRef<(() => void) | null>(null);

  function bindMotionValueCallback() {
    'main thread';

    valueMTRef.current ??= motionValue(0.5);

    unsubscribeMTRef.current = valueMTRef.current.on('change', (value) => {
      boxMTRef.current?.setStyleProperties({
        transform: `scale(${value})`,
      });
    });
  }

  function startAnimation() {
    'main thread';

    bindMotionValueCallback();

    intervalMTRef.current = setInterval(() => {
      valueMTRef.current?.set(valueMTRef.current.get() + 0.5);
    }, 1000);
  }

  function endAnimation() {
    'main thread';

    if (intervalMTRef.current) {
      clearInterval(intervalMTRef.current);
      intervalMTRef.current = null;
    }

    if (unsubscribeMTRef.current) {
      unsubscribeMTRef.current();
      unsubscribeMTRef.current = null;
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void runOnMainThread(startAnimation)();
    }, 1000);
    return () => {
      clearTimeout(timeoutId);
      void runOnMainThread(endAnimation)();
    };
  }, []);

  return (
    <view className='case-container'>
      <view
        main-thread:ref={boxMTRef}
        style={{
          width: '100px',
          height: '100px',
          backgroundColor: '#8df0cc',
          borderRadius: '10px',
          transform: 'scale(1.5)',
        }}
      >
      </view>
    </view>
  );
}
