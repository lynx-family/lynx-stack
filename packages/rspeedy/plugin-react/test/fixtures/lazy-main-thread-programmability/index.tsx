import { Suspense, lazy } from '@lynx-js/react'

const LazyComponent = lazy(() => import('./LazyComponent.js'))

export default function App() {
  return (
    <Suspense fallback={null}>
      <LazyComponent />
    </Suspense>
  )
}
