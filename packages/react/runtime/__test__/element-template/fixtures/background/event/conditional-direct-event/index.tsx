interface AppProps {
  show?: boolean;
  onTap?: () => void;
}

export function App({ show = true, onTap }: AppProps) {
  return <view>{show ? <text bindtap={onTap}>tap</text> : null}</view>;
}
