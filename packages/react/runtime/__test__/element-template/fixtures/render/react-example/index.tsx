import { useCallback, useEffect, useState } from '@lynx-js/react';

const arrow = './assets/arrow.png';
const lynxLogo = './assets/lynx-logo.png';
const reactLynxLogo = './assets/react-logo.png';

export function App() {
  const [alterLogo, setAlterLogo] = useState(false);

  useEffect(() => {
    console.info('Hello, ReactLynx');
  }, []);

  const onTap = useCallback(() => {
    'background-only';
    setAlterLogo(prevAlterLogo => !prevAlterLogo);
  }, []);

  return (
    <view>
      <view className='Background' />
      <view className='App'>
        <view className='Banner'>
          <view className='Logo' bindtap={onTap}>
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
