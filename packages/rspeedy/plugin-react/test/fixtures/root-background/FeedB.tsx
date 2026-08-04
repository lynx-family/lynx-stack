function feedBLogic(): string {
  return 'feed-B-deferred-logic'
}
export function FeedB(): JSX.Element {
  return (
    <view>
      <text>{feedBLogic()}</text>
    </view>
  )
}
