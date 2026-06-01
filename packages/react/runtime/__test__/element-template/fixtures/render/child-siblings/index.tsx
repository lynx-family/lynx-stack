export function App() {
  return (
    <view>
      <Sub>
        <text>Slot Content 1</text>
      </Sub>
      <Sub>
        <text>Slot Content 2</text>
      </Sub>
    </view>
  );
}

function Sub(props: any) {
  return <view>{props.children}</view>;
}
