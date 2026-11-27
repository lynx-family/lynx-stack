import { Island } from '@lynx-js/islands/react';
import { useState } from '@lynx-js/react';

import './App.css';

declare const __ISLAND_ENTRY__: string;

export function App() {
  const [visible, setVisible] = useState(true);
  const [count, setCount] = useState(0);
  return (
    <view className='App'>
      <text className='Title'>Remote Island</text>
      <view
        id='update'
        className='Button'
        bindtap={() => setCount(value => value + 1)}
      >
        <text>Update greeting</text>
      </view>
      <view
        id='toggle'
        className='Button'
        bindtap={() => setVisible(value => !value)}
      >
        <text>{visible ? 'Unmount' : 'Mount'}</text>
      </view>
      {visible && (
        <Island
          name='greeting'
          entry={__ISLAND_ENTRY__}
          props={{ title: `Greeting ${count}` }}
          className='Card'
        />
      )}
    </view>
  );
}
