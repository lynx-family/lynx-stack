function MyComp({ name }: { name: string }) {
  return (
    <view class='comp'>
      {name}
    </view>
  );
}

export function App() {
  return (
    <view class='root'>
      <MyComp name='inner' />
    </view>
  );
}
