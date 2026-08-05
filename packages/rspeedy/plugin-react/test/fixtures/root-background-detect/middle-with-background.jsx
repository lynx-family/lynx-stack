import { Background } from '@lynx-js/react'

export function Middle() {
  return (
    <view>
      <Background fallback={<text>Loading…</text>}>
        <Feed />
      </Background>
    </view>
  )
}
