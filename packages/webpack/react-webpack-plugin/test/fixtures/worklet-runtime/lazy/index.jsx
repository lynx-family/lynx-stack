import { Suspense, lazy } from '@lynx-js/react';

const Lazy = lazy(() => import('./lazy.jsx'));

export default function App() {
  const onTap = () => {
    'main thread';
  };

  return (
    <view bindtap={onTap}>
      <Suspense fallback={null}>
        <Lazy />
      </Suspense>
    </view>
  );
}
