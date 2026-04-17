interface AppProps {
  items?: string[];
}

function Item({ id }: { id: string }) {
  return <view id={id} />;
}

export function App({ items = [] }: AppProps) {
  return (
    <view>
      {items.map((id) => (
        <Item id={id} />
      ))}
    </view>
  );
}

export const mainProps = { items: ['1', '2'] };
export const backgroundProps = { items: ['2', '1'] };
