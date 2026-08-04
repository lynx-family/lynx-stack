// Fallback island. Deliberately its OWN module: if it shared one
// with the deferred content, pulling the fallback in would drag that along and
// the bundle question could not be answered.
export function Sk({ id, c = '#c9d5e3' }) {
  const rows = [0, 1];
  return (
    <view style={{ display: 'flex', flexDirection: 'column' }}>
      {rows.map((r) => (
        <view
          key={r}
          id={`sk-${id}-${r}`}
          style={{
            width: '200px',
            height: '20px',
            margin: '3px',
            backgroundColor: c,
          }}
        />
      ))}
    </view>
  );
}
export function skLogic() {
  return 'SK-LOGIC';
}
