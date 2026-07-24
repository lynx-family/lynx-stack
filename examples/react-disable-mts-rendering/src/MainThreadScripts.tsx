import {
  runOnBackground,
  runOnMainThread,
  useCallback,
  useMainThreadRef,
  useState,
} from '@lynx-js/react';
import type { MainThread } from '@lynx-js/types';

// Demonstrates that main-thread scripts still work with
// `enableMTSRendering: false`: worklets and their runtime register on the
// main thread through the collected defines, even though the first frame is
// rendered by the background thread.
export function MainThreadScripts() {
  const [roundTrip, setRoundTrip] = useState('not run');
  const tapCountMTRef = useMainThreadRef<number>(0);

  // A main-thread event handler (worklet): runs on the main thread, animates
  // the tapped element and reads/writes a main-thread ref synchronously.
  const onTapMT = useCallback((e: MainThread.TouchEvent) => {
    'main thread';
    const count = (tapCountMTRef.current ?? 0) + 1;
    tapCountMTRef.current = count;
    e.currentTarget.animate([
      { transform: 'scale(1)' },
      { transform: 'scale(0.94)' },
      { transform: 'scale(1)' },
    ], { duration: 160, iterations: 1 });
    // Hop to the background thread to update state with the main-thread count.
    void runOnBackground(setRoundTrip)(`tapped ${count}x (from MTS)`);
  }, [tapCountMTRef]);

  // Background handler that hops to the main thread and back.
  const onTapRoundTrip = useCallback(() => {
    const readOnMainThread = (value: number) => {
      'main thread';
      return value * 2;
    };
    void runOnMainThread(readOnMainThread)(21).then((doubled: number) => {
      setRoundTrip(`main thread returned ${doubled}`);
    });
  }, []);

  return (
    <view className='card' style={{ marginTop: '16px' }}>
      <text className='title'>Main-thread scripts</text>
      <view className='button' main-thread:bindtap={onTapMT}>
        <text className='button-text'>worklet + MTS ref (tap me)</text>
      </view>
      <view
        className='button button-secondary'
        style={{ marginTop: '12px' }}
        bindtap={onTapRoundTrip}
      >
        <text className='button-text'>runOnMainThread round-trip</text>
      </view>
      <text className='subtitle' style={{ marginTop: '12px' }}>
        {roundTrip}
      </text>
    </view>
  );
}
