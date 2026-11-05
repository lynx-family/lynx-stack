import type { MainThread } from '@lynx-js/types';

function highlight(e: MainThread.TouchEvent) {
  'main thread';
  e.currentTarget.setStyleProperties({
    'background-color': 'rgba(94, 234, 149, 0.22)',
    'border-color': '#5eea95',
  });
}

export function BackgroundOnlyCard() {
  return (
    <view className='BgCard' main-thread:bindtap={highlight}>
      <text className='BgCard__title' data-probe='bg-only-in-lazy'>
        Background-only card
      </text>
      <text className='BgCard__hint'>
        Rendered only by the background thread — its snapshot and worklet were
        merged into this lazy bundle.
      </text>
      <text className='BgCard__hint'>Tap to run the merged worklet.</text>
    </view>
  );
}
