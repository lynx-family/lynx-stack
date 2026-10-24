import { runOnBackground } from './other-runtime.js';
import { readValue } from 'shared-value' with { runtime: 'shared' };

export function Other() {
  const onTap = () => {
    'main thread';
    runOnBackground(() => {
      'background only';
    })();
    return readValue();
  };
  return <view main-thread:bindtap={onTap} />;
}
