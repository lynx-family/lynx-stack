import { animate } from '@lynx-js/motion-lynx';
import { runOnMainThread, useEffect, useMainThreadRef } from '@lynx-js/react';
import type { MainThread } from '@lynx-js/types';

import './styles.css';

export default function BasicPercent() {
  const animateMTRef = useMainThreadRef<ReturnType<typeof animate> | null>(
    null,
  );
  const boxMTRef = useMainThreadRef<MainThread.Element>(null);

  function startAnimation() {
    'main thread';

    if (boxMTRef.current) {
      animateMTRef.current = animate(
        boxMTRef.current,
        { width: ['10px', '50%'] },
        {
          ease: 'circInOut',
          duration: 1,
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
          width: '300px',
          height: '100px',
          backgroundColor: '#8df0cc',
          borderRadius: '10px',
        }}
      >
      </view>
    </view>
  );
}
