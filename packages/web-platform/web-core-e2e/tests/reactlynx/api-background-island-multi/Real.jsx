// The deferred content. Its logic never reaches the main-thread bundle.
export function Real({ label, color }) {
  const text = `real-${label}`;
  return (
    <view
      id={`real-${label}`}
      style={{
        width: '280px',
        height: '100px',
        margin: '4px',
        backgroundColor: color,
        display: 'flex',
      }}
    >
      <text style={{ color: 'white', fontSize: '16px' }}>{text}</text>
    </view>
  );
}
