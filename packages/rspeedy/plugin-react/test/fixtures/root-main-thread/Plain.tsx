// Deliberately missing the `'main thread component'` directive: the build has
// to say so and fall back to the boundary's static `fallback`.
export function Plain() {
  // Only reachable if this module is compiled into the main-thread layer —
  // a snapshot definition carries the markup, never the render body.
  console.info('root-main-thread-unmarked-body-marker')

  return (
    <view className='page'>
      <text>root-main-thread-unmarked-marker</text>
    </view>
  )
}
