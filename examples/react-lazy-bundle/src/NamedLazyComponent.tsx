import { useEffect, useState } from '@lynx-js/react';

import './NamedLazyComponent.css';

export default function NamedLazyComponent() {
  const [thread, setThread] = useState('main thread');

  useEffect(() => {
    setThread('background thread');
  }, []);

  return (
    <view className='NamedCard'>
      <view className='NamedCard__badge'>
        <text className='NamedCard__badgeText'>webpackChunkName</text>
      </view>
      <text className='NamedCard__title'>named-lazy</text>
      <text className='NamedCard__hint' data-probe='named-lazy-thread'>
        Hydrated by the {thread}
      </text>
    </view>
  );
}
