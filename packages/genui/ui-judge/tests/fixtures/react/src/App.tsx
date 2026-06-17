import { useCallback, useEffect, useState } from '@lynx-js/react';

import './App.css';
import { useFlappy } from './useFlappy.js';

export function App() {
  const [alterLogo, setAlterLogo] = useState(false);
  const [logoY, jump] = useFlappy();

  useEffect(() => {
    console.info('Hello, ReactLynx');
  }, []);

  const onTap = useCallback(() => {
    'background-only';
    setAlterLogo(prevAlterLogo => !prevAlterLogo);
  }, []);

  return (
    <view bindtap={jump}>
      <view className='Background' />
      <view className='App'>
        <view className='Banner'>
          <view
            className='Logo'
            style={{ transform: `translateY(${logoY}px)` }}
            bindtap={onTap}
          >
            {alterLogo
              ? (
                <view className='LogoMark LogoMark--react'>
                  <view className='ReactOrbit ReactOrbit--one' />
                  <view className='ReactOrbit ReactOrbit--two' />
                  <view className='ReactOrbit ReactOrbit--three' />
                  <view className='ReactCore' />
                </view>
              )
              : (
                <view className='LogoMark LogoMark--lynx'>
                  <view className='LynxEar LynxEar--left' />
                  <view className='LynxEar LynxEar--right' />
                  <text className='LynxFace'>L</text>
                </view>
              )}
          </view>
          <text className='Title'>React</text>
          <text className='Subtitle'>on Lynx</text>
        </view>
        <view className='Content'>
          <view className='Arrow' />
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
