import { useGlobalProps, useInitData, useState } from '@lynx-js/react';

import { greeting } from './greeting';

export function MainCard() {
  const [count, setCount] = useState(0);
  const initData = useInitData();
  const globalProps = useGlobalProps();
  return (
    <view className='page' bindtap={() => setCount(c => c + 1)}>
      <text id='title' className='title'>Main card</text>
      <text id='greeting'>{greeting}</text>
      <text id='count'>count:{count}</text>
      <text id='init-data'>{JSON.stringify(initData)}</text>
      <text id='global-props'>{JSON.stringify(globalProps)}</text>
    </view>
  );
}
