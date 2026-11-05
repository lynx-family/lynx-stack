import { runOnBackground, useMainThreadRef } from '@lynx-js/react';

interface AppProps {
  label?: string;
  enabled?: boolean;
  show?: boolean;
  onReport?: (label: string, count: number) => string;
}

export function App({ label = 'first', enabled = true, show = true, onReport = () => '' }: AppProps) {
  const count = useMainThreadRef(0);
  const onUpdate = () => {
    'main thread';
    count.current += 1;
    return runOnBackground(onReport)(label, count.current);
  };
  const gesture = enabled
    ? {
      __isGesture: true,
      id: 17,
      type: 0,
      config: { enabled: true },
      callbacks: { onUpdate },
    }
    : null;
  return show
    ? (
      <view>
        <text main-thread:gesture={gesture}>Drag</text>
      </view>
    )
    : <view />;
}
