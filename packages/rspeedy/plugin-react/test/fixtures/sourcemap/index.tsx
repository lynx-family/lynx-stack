import { root, Suspense, lazy } from '@lynx-js/react'

const LazyBundleComp = lazy(() => import('./lazy-bundle-comp.jsx'))

console.info('Hello, Lynx x rsbuild')

function innerFunction() {
  console.info('innerFunction')
}

function functionThatThrows() {
  let a = 'message'.repeat(3)
  innerFunction()
  throw new Error(`This is an error: ${a}`)
}

function App() {
  functionThatThrows()

  return (
    <view>
      <text>Hello, Lynx x rsbuild</text>
      <Suspense fallback={<text>Loading...</text>}>
        <LazyBundleComp />
      </Suspense>
    </view>
  )
}

root.render(
  <page>
    <App />
  </page>,
)
