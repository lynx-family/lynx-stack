interface SpreadProps {
  id?: string;
  ref?: unknown;
}

interface AppProps {
  directRef?: unknown;
  objectRef?: unknown;
  spread?: SpreadProps;
}

export function App({ directRef, objectRef, spread = {} }: AppProps) {
  return (
    <view>
      <view ref={directRef}>direct</view>
      <view ref={objectRef}>object</view>
      <view {...spread}>spread</view>
    </view>
  );
}
