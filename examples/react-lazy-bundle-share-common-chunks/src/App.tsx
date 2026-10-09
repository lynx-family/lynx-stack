import { Suspense, lazy } from '@lynx-js/react';

const PageA = lazy(() => import('./PageA.js'));
const PageB = lazy(() => import('./PageB.js'));

export function App() {
  return (
    <view style='flex-direction: column; padding: 24px;'>
      <Suspense fallback={<text>loading A</text>}>
        <PageA />
      </Suspense>
      <Suspense fallback={<text>loading B</text>}>
        <PageB />
      </Suspense>
    </view>
  );
}
