import { animate } from '@lynx-js/motion';
import { runOnMainThread, useEffect, useMainThreadRef } from '@lynx-js/react';
import type { MainThread } from '@lynx-js/types';

import './styles.css';

export default function ColorInterception() {
  const animateMTRef = useMainThreadRef<ReturnType<typeof animate> | null>(
    null,
  );
  const boxMTRef = useMainThreadRef<MainThread.Element>(null);

  function startAnimation() {
    'main thread';

    if (boxMTRef.current) {
      animateMTRef.current = animate(
        boxMTRef.current,
        {
          backgroundColor: '#0d63f8',
        },
        {
          duration: 2,
          repeat: Number.POSITIVE_INFINITY,
          repeatType: 'reverse',
        },
      );
    }
  }

  function endAnimation() {
    'main thread';

    animateMTRef.current?.stop();
  }

  useEffect(() => {
    void runOnMainThread(startAnimation)();
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
          backgroundColor: '#ff0088',
          borderRadius: '10px',
        }}
      >
      </view>
    </view>
  );
}
