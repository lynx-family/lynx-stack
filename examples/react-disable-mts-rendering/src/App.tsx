import { useCallback, useState } from '@lynx-js/react';
import type { MainThread } from '@lynx-js/types';

import './App.css';

export function App() {
  const [count, setCount] = useState(0);

  const onSpin = useCallback((e: MainThread.TouchEvent) => {
    'main thread';
    e.currentTarget.animate([
      { transform: 'rotate(0deg)' },
      { transform: 'rotate(360deg)' },
    ], {
      duration: 1000,
      iterations: 1,
    });
  }, []);

  return (
    <view className='App'>
      <text className='Title'>enableMTSRendering: false</text>
      <text className='Description'>
        The main thread renders nothing: this UI is inserted by the background
        thread, using the snapshot and worklet definitions collected while
        compiling it.
      </text>
      <view className='Card' main-thread:bindtap={onSpin}>
        <text className='Card__label'>Tap to spin on the main thread</text>
      </view>
      <view className='Card' bindtap={() => setCount(count + 1)}>
        <text className='Card__label'>Tapped {count} times</text>
      </view>
    </view>
  );
}
