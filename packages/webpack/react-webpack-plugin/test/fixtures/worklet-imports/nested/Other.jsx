import { runOnBackground } from './other-runtime.js';

export function Other() {
  const onTap = () => {
    'main thread';
    runOnBackground(() => {
      'background only';
    })();
  };
  return <view main-thread:bindtap={onTap} />;
}
