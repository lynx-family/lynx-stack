// The module asserts what the boundary only implies: it must never be
// reachable from the main thread. `background-only` resolves to a stub that
// errors the build when a main-thread module imports it, so this line turns
// "the fold quietly did not reach here" into a named failure.
import 'background-only';

export function Real({ id, c = '#2f6fd0' }) {
  const t = realLogic() + '-' + id;
  return (
    <view
      id={`real-${id}`}
      style={{
        width: '220px',
        height: '54px',
        margin: '3px',
        backgroundColor: c,
        display: 'flex',
      }}
    >
      <text style={{ color: 'white', fontSize: '13px' }}>{t}</text>
    </view>
  );
}
export function realLogic() {
  return 'REAL-LOGIC';
}
