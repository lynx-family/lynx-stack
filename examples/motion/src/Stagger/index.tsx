import { animate, stagger } from '@lynx-js/motion';
import { runOnMainThread, useEffect, useMainThreadRef } from '@lynx-js/react';
import './styles.css';

export default function Stagger() {
  const animateMTRef = useMainThreadRef<ReturnType<typeof animate> | null>(
    null,
  );

  function startAnimation() {
    'main thread';
    const els = lynx.querySelectorAll('.stagger-box');

    animateMTRef.current = animate(els, { y: [50, 0] }, {
      delay: stagger(0.05),
      repeat: Number.POSITIVE_INFINITY,
      repeatType: 'reverse',
    });
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
      <view className='stagger-box-container'>
        <view className='stagger-box'></view>
        <view className='stagger-box'></view>
        <view className='stagger-box'></view>
        <view className='stagger-box'></view>
      </view>
    </view>
  );
}
