import { useState } from '@lynx-js/react';

import './LazyComponent.css';
import { BackgroundOnlyCard } from './BackgroundOnlyCard.jsx';

lynx.performance.profileStart('reloadLab::lazy-bundle-eval');
let lazyBundleCounter = 0;
lynx.performance.profileEnd();

export default function LazyComponent() {
  const [counter, setCounter] = useState(lazyBundleCounter);

  function incrementCounter() {
    'background-only';
    setCounter(++lazyBundleCounter);
  }

  return (
    <view className='LazyCard'>
      <view className='LazyCard__badgeRow'>
        <view className='LazyCard__badge'>
          <text className='LazyCard__badgeText'>lazy bundle</text>
        </view>
      </view>
      <text className='LazyComponent'>LazyComponent</text>
      {__MAIN_THREAD__
        ? <view className='LazyCard__skeleton' />
        : <BackgroundOnlyCard />}
      <text className='BgCard__hint'>Lazy bundle counter: {counter}</text>
      <view bindtap={incrementCounter} className='LazyCard__counterButton'>
        <text className='LazyCard__badgeText'>counter +1</text>
      </view>
    </view>
  );
}
