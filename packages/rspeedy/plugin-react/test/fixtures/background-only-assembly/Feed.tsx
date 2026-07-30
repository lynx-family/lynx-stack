console.info('feed-top-level-side-effect-marker')

export function Feed(): JSX.Element {
  'background only'
  const label = 'feed-body-logic-marker'
  return (
    <view>
      <text>feed-snapshot-static-marker</text>
      <text>{label}</text>
    </view>
  )
}
