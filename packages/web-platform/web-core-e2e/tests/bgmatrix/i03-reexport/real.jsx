'use-marker';
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
