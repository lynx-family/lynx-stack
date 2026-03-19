import { Suspense, lazy } from '@lynx-js/react'
import './index.css'

const LazyComponent = lazy(() => import('./LazyComponent.js'))

export function App() {
  return (
    <view className='Suspense'>
      <Suspense fallback={<text>Loading...</text>}>
        <LazyComponent />
      </Suspense>
    </view>
  )
}
