// A *component* fallback: its body runs on the main thread, so it may compute
// its own children. That is what makes it an island rather than a template.
export function Skeleton({ label, color }) {
  const rows = [0, 1, 2];
  return (
    <view style={{ display: 'flex', flexDirection: 'column', padding: '8px' }}>
      {rows.map((row) => (
        <view
          key={row}
          id={`skeleton-${label}-${row}`}
          style={{
            width: '260px',
            height: '28px',
            margin: '4px',
            backgroundColor: color,
          }}
        />
      ))}
    </view>
  );
}
