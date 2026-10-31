import { Suspense, lazy } from '@lynx-js/react'

const PageA = lazy(() => import('./PageA.js'))
const PageB = lazy(() => import('./PageB.js'))

export function App() {
  return (
    <view>
      <Suspense fallback={<text>Loading A</text>}>
        <PageA />
      </Suspense>
      <Suspense fallback={<text>Loading B</text>}>
        <PageB />
      </Suspense>
    </view>
  )
}
