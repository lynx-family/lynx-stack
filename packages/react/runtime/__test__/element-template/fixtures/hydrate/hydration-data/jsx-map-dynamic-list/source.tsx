export function App() {
  return (
    <view>
      {[1, 2, 3].map((i) => (
        <view key={i}>
          <text>{`item-${i}`}</text>
        </view>
      ))}
    </view>
  );
}
