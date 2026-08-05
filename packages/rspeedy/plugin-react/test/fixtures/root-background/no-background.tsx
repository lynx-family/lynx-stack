import { root } from '@lynx-js/react'

// An app that defers nothing: no `<Background>` anywhere in its graph.
function PlainApp(): JSX.Element {
  return (
    <view>
      <text>no-background-entry</text>
    </view>
  )
}

root.render(
  <page>
    <PlainApp />
  </page>,
)
