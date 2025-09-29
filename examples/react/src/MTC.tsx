'main thread'

import {useState} from '@lynx-js/react';
import {MainThread} from '@lynx-js/types';

let first = true;

export function MTComponent(props) {
  const [num, setNum] = useState(0);

  return (
    <view
      ref={(e: MainThread.Element) => {
        // console.log('user ref e', e);
        if (e && first) {
          e.setStyleProperties({
            'background-color': 'red',
          });
          first = false;
          // color.value = 'red';
        }
      }}
    >
      <text bindtap={() => setNum(num + 1)}>HELLO {num}</text>
      {props.btc1}
      {props.btc2}
    </view>
  );
}
