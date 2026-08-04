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

// The island. Nothing marks this module: the root `<MainThread>` references
// it, so the build compiles it — and everything it renders — for the main
// thread. Keep those imports small, and put what should not come along behind
// a `<Background>` (see `Feed` below), which the main thread folds away.
//
// A component that must be on the main thread even though nothing on this
// path reaches it says so at its definition, with the
// `'main thread component'` directive.
export function Shell() {
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
