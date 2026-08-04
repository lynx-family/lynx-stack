function feedCLogic(): string {
  return 'feed-C-deferred-logic'
}
export function FeedC(): JSX.Element {
  return (
    <view>
      <text>{feedCLogic()}</text>
    </view>
  )
}
