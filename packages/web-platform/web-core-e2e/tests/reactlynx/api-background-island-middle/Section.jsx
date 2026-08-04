import { Background } from '@lynx-js/react';

import { Real } from './Real.jsx';
import { Skeleton } from './Skeleton.jsx';

// Not deferred: this component's body runs on the main thread, and it is what
// positions the island inside it.
export function Section() {
  return (
    <view style={{ display: 'flex', flexDirection: 'column' }}>
      <view
        id='header'
        style={{ width: '280px', height: '40px', backgroundColor: '#1f9d55' }}
      />
      <Background fallback={<Skeleton label='mid' color='#c9d5e3' />}>
        <Real label='mid' color='#2f6fd0' />
      </Background>
    </view>
  );
}
