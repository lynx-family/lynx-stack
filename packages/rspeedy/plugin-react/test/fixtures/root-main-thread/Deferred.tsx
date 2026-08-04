import { MainThread } from '@lynx-js/react'

import { Header } from './Header.js'

export function Deferred() {
  // Body code: only reaches the main thread if this module is compiled for it.
  console.info('root-main-thread-deferred-body-marker')

  return (
    <view className='deferred'>
      <MainThread>
        <Header />
      </MainThread>
    </view>
  )
}
