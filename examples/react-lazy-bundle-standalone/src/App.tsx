import { Suspense, lazy, useEffect } from '@lynx-js/react';

import { createProducerBundleUrl } from './entry-url.js';

import './App.css';

let LazyComponentDemo: () => JSX.Element;
if (__LAZY_BUNDLE_FETCHER__ === 'FetchBundle') {
  const LazyComponentSync = lazy(() =>
    import(createProducerBundleUrl('LazyComponentSync.lynx.bundle'), {
      with: { type: 'component', mode: 'sync' },
    })
  );
  const LazyComponentAsync = lazy(() =>
    import(createProducerBundleUrl('LazyComponentAsync.lynx.bundle'), {
      with: { type: 'component', mode: 'async' },
    })
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
  const LazyComponent = lazy(() =>
    import(createProducerBundleUrl('LazyComponent.lynx.bundle'), {
      with: { type: 'component' },
    })
  );
  LazyComponentDemo = () => (
    <Suspense fallback={<text>Loading...</text>}>
      <LazyComponent />
    </Suspense>
  );
}

export function App() {
  useEffect(() => {
    console.info('Hello, ReactLynx');
    void import(createProducerBundleUrl('add.lynx.bundle'), {
      with: {
        type: 'component',
      },
    }).then((res: typeof import('./utils/add.js')) => {
      console.info('dynamic import add', res.add(1, 2));
    });
    void import(createProducerBundleUrl('dynamic.lynx.bundle'), {
      with: {
        type: 'component',
      },
    }).then((res: typeof import('./utils/dynamic.js')) => {
      console.info('dynamic import dynamic');
      void res.dynamicAdd(1, 2).then((res) => {
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
