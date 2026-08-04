import { Background } from '@lynx-js/react';

import { Real } from './Real.jsx';
import { Skeleton } from './Skeleton.jsx';

export function Section() {
  return (
    <view style={{ display: 'flex', flexDirection: 'column' }}>
      <view
        id='header'
        style={{ width: '280px', height: '40px', backgroundColor: '#1f9d55' }}
      />
      <Background fallback={<Skeleton label='c' color='#e3d5c9' />}>
        <Real label='c' color='#d06f2f' />
      </Background>
    </view>
  );
}
