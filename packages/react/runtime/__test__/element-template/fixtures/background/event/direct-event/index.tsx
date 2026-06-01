interface AppProps {
  onTap?: () => void;
}

export function App({ onTap }: AppProps) {
  return <view bindtap={onTap} />;
}
