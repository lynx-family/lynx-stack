import {
  GlobalLazyBundleResponseListener,
  Suspense,
  lazy,
} from '@lynx-js/react';

const Foo = lazy(async () => {
  await new Promise((resolve) => {
    setTimeout(() => {
      resolve(0);
    }, 1000);
  });
  return import('./Foo.jsx');
});
const Bar = lazy(() => import('./Bar.jsx'));
const FooBar = lazy(async () => {
  const Foo = await import('./Foo.jsx');
  const Bar = await import('./Bar.jsx');
  return {
    default: () => {
      return (
        <view>
          <Foo.default />
          <Bar.default />
        </view>
      );
    },
  };
});

export function App() {
  return (
    <>
      <view
        style={{
          height: '100vh',
          width: '100vw',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Suspense>
          <Foo />
        </Suspense>
        <Suspense>
          <view>
            <Bar />
          </view>
        </Suspense>
        <Suspense>
          <view>
            <FooBar />
          </view>
        </Suspense>
      </view>
      <GlobalLazyBundleResponseListener
        onResponse={(response) => {
          console.info('response', response);
        }}
      />
    </>
  );
}
