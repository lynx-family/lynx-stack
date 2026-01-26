import {
  runOnMainThread,
  useCallback,
  useEffect,
  useState,
} from '@lynx-js/react';

import arrow from './assets/arrow.png';
import lynxLogo from './assets/lynx-logo.png';
import reactLynxLogo from './assets/react-logo.png';
import { useMotionValue } from './MotionValue.js';

import './App.css';

export function App() {
  const [alterLogo, setAlterLogo] = useState(false);

  // NEW: MotionValue POC (uses .value) - demonstrates extensible main thread values!
  const opacity = useMotionValue(1);
  const tapCount = useMotionValue(0);

  useEffect(() => {
    console.info('Hello, ReactLynx');

    let unsubscribeHandle: (() => void) | undefined;

    runOnMainThread(() => {
      'main thread';

      // Demo: Subscribe to value changes (main thread only)
      const unsubscribe = opacity.subscribe((newValue) => {
        console.info('Opacity changed to:', newValue);
      });

      // Demo: Subscribe to value changes (main thread only)
      const unsubscribeTapCount = tapCount.subscribe((newValue) => {
        console.info('TapCount changed to:', newValue);
      });

      return () => {
        unsubscribe();
        unsubscribeTapCount();
      };
    })().then((res) => {
      unsubscribeHandle = res as () => void;
    }).catch(_err => {
      // omitted
    });

    return () => {
      void runOnMainThread(unsubscribeHandle!)();
    };
  }, []);

  const onTap = useCallback(() => {
    'background-only';
    setAlterLogo(prevAlterLogo => !prevAlterLogo);
  }, []);

  // Demo: MotionValue in tap handler
  const onLogoTap = () => {
    'main thread';
    tapCount.value += 1;
    // Animate opacity based on tap count
    opacity.value = 0.5 + (tapCount.value % 2) * 0.5;
  };

  return (
    <view>
      <view className='Background' />
      <view className='App'>
        <view className='Banner'>
          <view
            className='Logo'
            bindtap={onTap}
            main-thread:bindtap={onLogoTap}
          >
            {alterLogo
              ? <image src={reactLynxLogo} className='Logo--react' />
              : <image src={lynxLogo} className='Logo--lynx' />}
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
