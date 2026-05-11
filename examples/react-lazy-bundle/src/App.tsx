import { Suspense, lazy, useEffect } from '@lynx-js/react';

import './App.css';

let LazyComponentDemo: () => JSX.Element;
if (__LAZY_BUNDLE_FETCHER__ === 'FetchBundle') {
  const LazyComponentSync = lazy(() =>
    import('./LazyComponentSync.js', { with: { mode: 'sync' } })
  );
  const LazyComponentAsync = lazy(() =>
    import('./LazyComponentAsync.js', { with: { mode: 'async' } })
  );
  LazyComponentDemo = () => (
    <>
      <Suspense fallback={<text>Loading sync...</text>}>
        <LazyComponentSync />
      </Suspense>
      <Suspense fallback={<text>Loading async...</text>}>
        <LazyComponentAsync />
      </Suspense>
    </>
  );
} else {
  const LazyComponent = lazy(() => import('./LazyComponent.js'));
  LazyComponentDemo = () => (
    <Suspense fallback={<text>Loading...</text>}>
      <LazyComponent />
    </Suspense>
  );
}

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
          <LazyComponentDemo />
        </view>
      </view>
    </view>
  );
}
