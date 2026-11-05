import { useState } from '@lynx-js/react';

import { describe, describeOnMainThread } from './shared.js';

function onTap() {
  'main thread';
  console.info(describeOnMainThread('PageB-main-thread'));
}

export default function PageB() {
  const [taps, setTaps] = useState(0);
  const description = describe('PageB');

  return (
    <view id='page-b' className='page-card card-b' main-thread:bindtap={onTap}>
      <view className='card-top'>
        <text className='page-number'>02 / LAZY BUNDLE</text>
        <text className='ready-badge'>Loaded</text>
      </view>
      <text className='page-title'>Page B</text>
      <text className='page-description'>
        Another page, the same shared module.
      </text>
      <view className='module-panel'>
        <text className='module-label'>From shared.ts</text>
        <text className='module-value'>{description}</text>
        <text className='module-detail'>
          Both pages reuse the same shared module
        </text>
      </view>
      <view className='card-bottom'>
        <text className='shared-label'>Shared styles · shared.css</text>
        <view
          className='tap-button'
          bindtap={() =>
            setTaps(value =>
              value + 1
            )}
        >
          <text className='tap-button-text'>
            {taps ? `${taps} ${taps === 1 ? 'tap' : 'taps'} ↗` : 'Tap me ↗'}
          </text>
        </view>
      </view>
    </view>
  );
}
