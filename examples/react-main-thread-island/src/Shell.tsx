import { Background } from '@lynx-js/react';
import type { MainThread } from '@lynx-js/types';

import './Shell.css';
import { Feed } from './Feed.jsx';

function onSpin(e: MainThread.TouchEvent): void {
  'main thread';
  e.currentTarget.animate([
    { transform: 'rotate(0deg)' },
    { transform: 'rotate(360deg)' },
  ], { duration: 1000, iterations: 1 });
}

export function Shell() {
  // The marker that puts this module in the main-thread layer. Everything it
  // imports comes with it, so keep the island's imports small and mark the
  // deferred parts `'background only'` (see `Feed`).
  'main thread component';

  return (
    <view className='App'>
      <text className='Title'>main-thread island</text>
      <text className='Description'>
        This header is painted by the main thread on the first frame, before the
        background thread exists — and the background adopts it when it
        hydrates, instead of tearing it down and re-inserting it.
      </text>
      <view className='Card' main-thread:bindtap={onSpin}>
        <text className='Card__label'>
          Tap to spin — works on the first frame
        </text>
      </view>
      <Background fallback={<view className='FeedSkeleton' />}>
        <Feed />
      </Background>
    </view>
  );
}
