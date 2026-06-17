import { useCallback, useRef, useState } from '@lynx-js/react';

import './App.css';

const initialItems = Array.from({ length: 3 }, (_, index) => index + 1);

export function App() {
  const [items, setItems] = useState(initialItems);
  const [selected, setSelected] = useState('none');
  const [firstItemRefStatus, setFirstItemRefStatus] = useState('pending');
  const firstItemRef = useRef<unknown>(null);

  const bindFirstItemRef = useCallback((node: unknown) => {
    'background-only';
    firstItemRef.current = node;
    setFirstItemRefStatus(node ? 'attached' : 'detached');
  }, []);

  const handleItemTap = useCallback((item: number) => {
    'background-only';
    setSelected(`item ${item}`);
  }, []);

  const moveLastToFront = useCallback(() => {
    'background-only';
    setItems(prevItems => {
      const last = prevItems[prevItems.length - 1];
      if (last === undefined) {
        return prevItems;
      }
      return [last, ...prevItems.slice(0, -1)];
    });
  }, []);

  const removeFirst = useCallback(() => {
    'background-only';
    setItems(prevItems => prevItems.slice(1));
  }, []);

  const appendItem = useCallback(() => {
    'background-only';
    setItems(prevItems => {
      const next = (prevItems.reduce((max, item) =>
        Math.max(max, item), 0) || 0) + 1;
      return [...prevItems, next];
    });
  }, []);

  return (
    <view className='Page'>
      <view className='Header'>
        <text className='Title'>ET List Manual Test</text>
        <text className='Status'>selected: {selected}</text>
        <text className='Status'>first item ref: {firstItemRefStatus}</text>
        <text className='Status'>count: {items.length}</text>
      </view>

      <view className='Actions'>
        <view className='Action' bindtap={moveLastToFront}>
          <text className='ActionText'>Move Last To Front</text>
        </view>
        <view className='Action' bindtap={removeFirst}>
          <text className='ActionText'>Remove First</text>
        </view>
        <view className='Action' bindtap={appendItem}>
          <text className='ActionText'>Append</text>
        </view>
      </view>

      <list
        list-type='single'
        className='Feed'
        style={{ width: '100%', height: '620px', backgroundColor: '#1e232b' }}
      >
        {items.map((item, index) => (
          <list-item
            item-key={`${item}`}
            key={item}
            {...(index === 0 ? { ref: bindFirstItemRef } : {})}
            reuse-identifier='manual-list-item'
            className='FeedItem'
            style={{
              width: '100%',
              height: '96px',
              backgroundColor: '#f4d35e',
              borderWidth: '3px',
              borderColor: '#2b8a3e',
              justifyContent: 'center',
              paddingLeft: '16px',
              paddingRight: '16px',
            }}
            bindtap={() => handleItemTap(item)}
          >
            <view className='ItemBody'>
              <text className='ItemTitle'>Item {item}</text>
              <text className='ItemMeta'>key={item} index={index}</text>
            </view>
          </list-item>
        ))}
      </list>
    </view>
  );
}
