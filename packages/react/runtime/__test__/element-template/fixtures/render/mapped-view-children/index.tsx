export function App() {
  const items = ['A', 'B', 'C'];

  return (
    <view>
      {items.map(item => (
        <view id={item}>
          <text>{item}</text>
        </view>
      ))}
    </view>
  );
}
