// Logic, not an element definition: it must not reach the main-thread bundle.
function heavyAppLabel(): string {
  return 'root-background-business-marker'
}

export function HeavyApp(): JSX.Element {
  return (
    <view>
      <text>{heavyAppLabel()}</text>
    </view>
  )
}
