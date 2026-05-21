interface AppProps {
  showHeader?: boolean;
  items?: string[];
}

export function App({ showHeader = false, items = ['body'] }: AppProps) {
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
