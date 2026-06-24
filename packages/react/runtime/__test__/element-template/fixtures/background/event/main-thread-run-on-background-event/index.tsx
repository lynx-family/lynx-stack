import { runOnBackground } from '@lynx-js/react';

interface AppProps {
  label?: string;
  onReport?: (label: string) => string;
}

export function App({ label = 'first', onReport = () => '' }: AppProps) {
  const handleTap = () => {
    'main thread';
    return runOnBackground(onReport)(label);
  };
  return <view main-thread:bindtap={handleTap} />;
}
