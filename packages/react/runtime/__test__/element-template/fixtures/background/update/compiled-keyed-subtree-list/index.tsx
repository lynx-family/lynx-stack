interface AppProps {
  items?: string[];
}

function Item({ id }: { id: string }) {
  return (
    <view id={id}>
      <text>{id}</text>
    </view>
  );
}

export function App({ items = [] }: AppProps) {
  return (
    <view>
      {items.map(item => <Item key={item} id={item} />)}
    </view>
  );
}
