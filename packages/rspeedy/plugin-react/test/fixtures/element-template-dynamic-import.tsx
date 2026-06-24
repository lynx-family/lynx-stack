import { Suspense, lazy, root } from '@lynx-js/react'

const LazyComponent = lazy(() =>
  import('https://example.com/LazyComponent.lynx.bundle', {
    with: {
      type: 'component',
    },
  })
)

root.render(
  <Suspense fallback={<text>Loading...</text>}>
    <LazyComponent />
  </Suspense>,
)
