export function Widget() {
  // Marked, and only reachable through a `<Background>` the main thread
  // folds away — so reference-reachability would leave it out. The marker is
  // what puts it in the main-thread bundle anyway.
  'main thread component'

  console.info('root-main-thread-widget-body-marker')

  return (
    <view className='widget'>
      <text>root-main-thread-widget-marker</text>
    </view>
  )
}
