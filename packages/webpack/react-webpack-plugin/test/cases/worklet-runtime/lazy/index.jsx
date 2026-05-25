import { Suspense, lazy } from '@lynx-js/react';

const Lazy = lazy(() => import('./lazy.jsx'));

export default function App() {
  const onTapMT = () => {
    'main thread';
  };

  return (
    <view>
      <text bindtap={onTapMT}>hello world</text>
      <Suspense fallback={null}>
        <Lazy />
      </Suspense>
    </view>
  );
}
