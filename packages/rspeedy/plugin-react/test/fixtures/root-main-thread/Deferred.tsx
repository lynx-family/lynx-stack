import { MainThread } from '@lynx-js/react'

import { Header } from './Header.js'

export function Deferred() {
  return (
    <view className='deferred'>
      <MainThread>
        <Header />
      </MainThread>
    </view>
  )
}
