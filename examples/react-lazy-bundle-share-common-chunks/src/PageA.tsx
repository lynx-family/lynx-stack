import { describe, seenPages } from './shared.js';

export default function PageA() {
  const onTap = () => {
    'main thread';
    console.info(describe('PageA-main-thread'));
  };

  return (
    <text id='page-a' main-thread:bindtap={onTap}>
      {describe('PageA')} seen={seenPages()}
    </text>
  );
}
