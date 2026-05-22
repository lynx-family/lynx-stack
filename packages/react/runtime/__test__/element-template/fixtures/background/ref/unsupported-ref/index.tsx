interface AppProps {
  mainThreadRef?: unknown;
  workletRef?: unknown;
}

export function App({ mainThreadRef, workletRef }: AppProps) {
  return (
    <view main-thread:ref={mainThreadRef} worklet:ref={workletRef}>
      unsupported
    </view>
  );
}
