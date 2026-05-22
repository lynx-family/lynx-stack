interface AppProps {
  hostRef?: unknown;
}

export function App({ hostRef }: AppProps) {
  return <view ref={hostRef}>direct</view>;
}
