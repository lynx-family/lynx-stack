import { Suspense, lazy } from '@lynx-js/react';

const Lazy = lazy(() => import('./lazy.jsx'));

export default function App() {
  return (
    <view>
      <text text='main-bundle-content' />
      <Suspense fallback={null}>
        <Lazy />
      </Suspense>
    </view>
  );
}
