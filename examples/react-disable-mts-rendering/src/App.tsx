import { useCallback, useState } from '@lynx-js/react';
import type { MainThread } from '@lynx-js/types';

import './App.css';

const items = Array.from({ length: 20 }, (_, index) => ({
  id: `item-${index}`,
  title: `Row ${index}`,
}));

export function App() {
  const [count, setCount] = useState(0);
  const [selected, setSelected] = useState('none');

  const onSpin = useCallback((e: MainThread.TouchEvent) => {
    'main thread';
    e.currentTarget.animate([
      { transform: 'rotate(0deg)' },
      { transform: 'rotate(360deg)' },
    ], {
      duration: 1000,
      iterations: 1,
    });
  }, []);

  return (
    <view className='App'>
      <text className='Title'>enableMTSRendering: false</text>
      <text className='Description'>
        The main thread renders nothing: this UI is inserted by the background
        thread, using the snapshot and worklet definitions collected while
        compiling it.
      </text>
      <view className='Card' main-thread:bindtap={onSpin}>
        <text className='Card__label'>Tap to spin on the main thread</text>
      </view>
      <view className='Card' bindtap={() => setCount(count + 1)}>
        <text className='Card__label'>Tapped {count} times</text>
      </view>
      <text className='Description'>Selected: {selected}</text>
      <list list-type='single' className='Feed'>
        {items.map(item => (
          <list-item
            key={item.id}
            item-key={item.id}
            reuse-identifier='row'
            className='FeedItem'
            bindtap={() => setSelected(item.title)}
          >
            <text className='Card__label'>{item.title}</text>
          </list-item>
        ))}
      </list>
    </view>
  );
}
