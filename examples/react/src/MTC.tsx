'main thread';

import { MainThread } from '@lynx-js/types';

export function MTC(props: any) {
  return (
    <view>
      <text
        bindtap={(e: MainThread.TouchEvent) => {
          console.log('click');
          e.currentTarget.setStyleProperties({
            'background-color': 'red',
          });
        }}
      >
        MTC
      </text>
      {props.btc1}
      {props.btc2}
    </view>
  );
}
