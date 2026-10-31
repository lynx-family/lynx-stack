import { describe, seenPages } from './shared.js';

export default function PageB() {
  const onTap = () => {
    'main thread';
    console.info(describe('PageB-main-thread'));
  };

  return (
    <text id='page-b' main-thread:bindtap={onTap}>
      {describe('PageB')} seen={seenPages()}
    </text>
  );
}
