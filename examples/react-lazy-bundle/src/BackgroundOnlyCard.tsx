export function BackgroundOnlyCard() {
  return (
    <view className='LazyComponent__bg'>
      <text data-probe='bg-only-in-lazy'>background only in lazy</text>
      <text>second line</text>
    </view>
  );
}
