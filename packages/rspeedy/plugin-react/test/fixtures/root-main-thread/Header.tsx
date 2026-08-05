export function Header() {
  // Body code: only reaches the main thread if this module is compiled for it.
  console.info('root-main-thread-header-body-marker')

  return (
    <view className='header'>
      <text>root-main-thread-header-marker</text>
    </view>
  )
}
