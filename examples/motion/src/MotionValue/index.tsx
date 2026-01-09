import { motionValue } from '@lynx-js/motion';
import type { MotionValue, animate } from '@lynx-js/motion';
import { runOnMainThread, useEffect, useMainThreadRef } from '@lynx-js/react';
import type { MainThread } from '@lynx-js/types';

import './styles.css';

export default function Basic() {
  const animateMTRef = useMainThreadRef<ReturnType<typeof animate> | null>(
    null,
  );
  const boxMTRef = useMainThreadRef<MainThread.Element>(null);
  const valueMTRef = useMainThreadRef<MotionValue<number>>();

  function bindMotionValueCallback() {
    'main thread';

    valueMTRef.current ??= motionValue(0.5);

    valueMTRef.current.on('change', (value) => {
      boxMTRef.current?.setStyleProperties({
        transform: `scale(${value})`,
      });
    });
  }

  function startAnimation() {
    'main thread';

    bindMotionValueCallback();

    setInterval(() => {
      valueMTRef.current?.set(valueMTRef.current.get() + 0.5);
    }, 1000);
  }

  function endAnimation() {
    'main thread';

    animateMTRef.current?.stop();
  }

  useEffect(() => {
    setTimeout(() => {
      void runOnMainThread(startAnimation)();
    }, 1000);
    return () => {
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
