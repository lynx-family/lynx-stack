'main thread';

import { signal } from '@lynx-js/react/signals';
import { MainThread } from '@lynx-js/types';

const textSignal = signal('MTC');

export function MTC(props: any) {
  return (
    <view
      bindtap={(e: MainThread.TouchEvent) => {
        console.log('click');
        e.currentTarget.setStyleProperties({
          'background-color': 'red',
        });
        textSignal.value = 'Hello World!';
      }}
    >
      <text>
        {textSignal}
      </text>
      {props.btc1}
      {props.btc2}
    </view>
  );
}
