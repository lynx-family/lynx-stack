import { Suspense, lazy, useEffect } from '@lynx-js/react';

import './App.css';

const LazyComponent = lazy(() => import('./LazyComponent.js'));

export function App() {
  useEffect(() => {
    console.info('Hello, ReactLynx');
    void import('./utils/add.js').then((res) => {
      console.info('dynamic import add', res.add(1, 2));
    });
    void import('./utils/dynamic.js').then((res) => {
      console.info('dynamic import dynamic');
      void res.dynamicAdd(1, 2).then(res => {
        console.info('dynamic add', res);
      });
    });
  }, []);

  return (
    <view>
      <view className='Background' />
      <view className='App'>
        <view className='Banner'>
          <text className='Title'>React</text>
          <text className='Subtitle'>on Lynx</text>
        </view>
        <view className='Suspense'>
          <Suspense fallback={<text>Loading...</text>}>
            <LazyComponent />
          </Suspense>
        </view>
      </view>
    </view>
  );
}
