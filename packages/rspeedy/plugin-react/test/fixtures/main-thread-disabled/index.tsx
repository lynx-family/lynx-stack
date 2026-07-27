import { root } from '@lynx-js/react'

import { Counter } from './Counter.js'

function App(): JSX.Element {
  return (
    <view>
      {__MAIN_THREAD__ ? null : <Counter />}
    </view>
  )
}

root.render(
  <page>
    <App />
  </page>,
)
