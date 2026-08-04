function feedALogic(): string {
  return 'feed-A-deferred-logic'
}
export function FeedA(): JSX.Element {
  return (
    <view>
      <text>{feedALogic()}</text>
    </view>
  )
}
