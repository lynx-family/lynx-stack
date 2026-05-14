interface SpreadProps {
  id?: string;
  ref?: unknown;
  'main-thread:ref'?: unknown;
  'worklet:ref'?: unknown;
}

interface AppProps {
  spread?: SpreadProps;
}

export function App({ spread = {} }: AppProps) {
  return <view {...spread}>spread</view>;
}
