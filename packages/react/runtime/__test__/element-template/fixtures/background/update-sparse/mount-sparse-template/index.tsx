interface AppProps {
  showCard?: boolean;
  showHeader?: boolean;
  items?: string[];
}

function SparseCard({ showHeader, items }: { showHeader: boolean; items: string[] }) {
  return (
    <view>
      <view id='header'>
        {showHeader && <text>header</text>}
      </view>
      <view id='body'>
        {items.map(item => <text key={item}>{item}</text>)}
      </view>
    </view>
  );
}

export function App({ showCard = false, showHeader = false, items = ['body'] }: AppProps) {
  return (
    <view id='root'>
      {showCard && <SparseCard showHeader={showHeader} items={items} />}
    </view>
  );
}
