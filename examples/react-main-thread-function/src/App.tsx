import { useCallback, useEffect } from '@lynx-js/react';
import type { MainThread } from '@lynx-js/types';

import './App.css';

import arrow from './assets/arrow.png';
import reactLynxLogo from './assets/react-logo.png';

export function App() {
  useEffect(() => {
    console.info('Hello, ReactLynx');
  }, []);

  const onTap = useCallback((e: MainThread.TouchEvent) => {
    'main thread';
    e.currentTarget.animate([
      {
        transform: 'rotate(0deg)',
      },
      {
        transform: 'rotate(360deg)',
      },
    ], {
      duration: 1000,
      iterations: 1,
    });
  }, []);

  return (
    <view>
      <view className='Background' />
      <view className='App'>
        <view className='Banner'>
          <view className='Logo'>
            <image
              src={reactLynxLogo}
              className='Logo--react'
              main-thread:bindtap={onTap}
            />
          </view>
          <text className='Title'>React</text>
          <text className='Subtitle'>on Lynx</text>
        </view>
        <view className='Content'>
          <image src={arrow} className='Arrow' />
          <text className='Description'>Tap the logo and have fun!</text>
          <text className='Hint'>
            Edit<text
              style={{
                fontStyle: 'italic',
                color: 'rgba(255, 255, 255, 0.85)',
              }}
            >
              {' src/App.tsx '}
            </text>
            to see updates!
          </text>
        </view>
        <view style={{ flex: 1 }}></view>
      </view>
    </view>
  );
}
