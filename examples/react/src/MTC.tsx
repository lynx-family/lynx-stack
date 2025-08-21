'main thread';

import { useRef } from '@lynx-js/react';
import { signal } from '@lynx-js/react/signals';
import { MainThread } from '@lynx-js/types';

const textSignal = signal('MTC');

export function MTC(props: any) {
  const ref = useRef(null);
  return (
    <view
      bindtap={(e: MainThread.TouchEvent) => {
        console.log('click');
        ref.current.setStyleProperties({
          'background-color': 'red',
        });
        textSignal.value = 'Hello World!';
      }}
    >
      <text ref={ref}>
        {textSignal}
      </text>
      {props.btc1}
      {props.btc2}
    </view>
  );
}
