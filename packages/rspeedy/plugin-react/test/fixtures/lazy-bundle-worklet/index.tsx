import { Suspense, lazy } from '@lynx-js/react'

const LazyComponent = lazy(() => import('./LazyComponent.js'))

export function App() {
  return (
    <view>
      <Suspense fallback={<text>Loading...</text>}>
        <LazyComponent />
      </Suspense>
    </view>
  )
}
