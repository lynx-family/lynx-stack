// A component used by BOTH the first-screen tree (from `App`) and a
// background-only tree (from `Feed`). Its module is not background-only, so
// its definition stays in place on the main thread; the background-scoped
// collection and the in-place subtraction must keep it from registering
// twice.
export function Shared() {
  return (
    <view>
      <text>SHARED_SNAPSHOT_STATIC_MARKER</text>
    </view>
  );
}
