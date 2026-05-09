interface SpreadProps {
  id?: string;
  className?: string;
  bindtap?: () => void;
}

interface AppProps {
  spread?: SpreadProps;
  onCatch?: () => void;
}

export function App({ spread = {}, onCatch }: AppProps) {
  return <view catchtap={onCatch} {...spread} />;
}
