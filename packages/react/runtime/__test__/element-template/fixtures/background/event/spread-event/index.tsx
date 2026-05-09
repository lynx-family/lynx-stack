interface SpreadProps {
  id?: string;
  className?: string;
  bindtap?: () => void;
}

interface AppProps {
  spread?: SpreadProps;
  onCatch?: () => void;
  showChild?: boolean;
  childSpread?: SpreadProps;
}

export function App({ spread = {}, onCatch, showChild = false, childSpread = {} }: AppProps) {
  return (
    <view catchtap={onCatch} {...spread}>
      {showChild ? <text {...childSpread}>tap</text> : null}
    </view>
  );
}
