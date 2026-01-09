import { animate } from '@lynx-js/motion';
import { runOnMainThread, useEffect, useMainThreadRef } from '@lynx-js/react';
import type { MainThread } from '@lynx-js/types';

import './styles.css';

export default function Text() {
  const animateMTRef = useMainThreadRef<ReturnType<typeof animate> | null>(
    null,
  );
  const textMTRef = useMainThreadRef<MainThread.Element>(null);

  function startAnimation() {
    'main thread';

    if (textMTRef.current) {
      animateMTRef.current = animate(0, 100, {
        ease: 'circInOut',
        duration: 2,
        onUpdate: (latest) => {
          textMTRef.current?.setAttribute('text', latest);
        },
      });
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
      <view>
        <text className='text-case' main-thread:ref={textMTRef}></text>
      </view>
    </view>
  );
}
