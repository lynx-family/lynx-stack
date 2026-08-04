// A helper the *body* of `Skeleton` calls. It is logic, not an element
// definition, so it only reaches the main-thread bundle if the fallback is
// really compiled for the main thread.
function skeletonRowLabel(row: number): string {
  return `skeleton-row-${row}-from-fallback-logic`
}

// A user component in the root fallback: its body runs on the main thread,
// so it may compute its children rather than being a static template.
export function Skeleton(): JSX.Element {
  const rows = [0, 1, 2]
  return (
    <view className='Skeleton'>
      {rows.map(row => (
        <view key={row} className='SkeletonRow'>
          <text>{skeletonRowLabel(row)}</text>
        </view>
      ))}
    </view>
  )
}
