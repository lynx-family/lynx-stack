import type { MainThread } from '@lynx-js/types';

function highlight(e: MainThread.TouchEvent) {
  'main thread';
  e.currentTarget.setStyleProperties({
    'background-color': 'rgba(94, 234, 149, 0.25)',
  });
}

export function BackgroundOnlyCard() {
  return (
    <view className='LazyComponent__bg' main-thread:bindtap={highlight}>
      <text data-probe='bg-only-in-lazy'>background only in lazy</text>
      <text>tap to highlight via the merged worklet</text>
    </view>
  );
}
