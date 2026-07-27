import { useCallback, useState } from '@lynx-js/preact-runtime';

export function App() {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<string[]>([]);

  const onTap = useCallback(() => {
    setCount((c) => c + 1);
  }, []);

  const addItem = useCallback(() => {
    setItems((list) => [...list, `item-${list.length}`]);
  }, []);

  const removeItem = useCallback(() => {
    setItems((list) => list.slice(0, -1));
  }, []);

  return (
    <view style={{ flexDirection: 'column', padding: '20px' }}>
      <text id='title' style={{ fontSize: '24px', color: 'blue' }}>
        Hello preact-runtime
      </text>
      <text id='count' data-count={count} bindtap={onTap}>
        Count: {count}
      </text>
      <view style={{ flexDirection: 'row', marginTop: '10px' }}>
        <text id='add' bindtap={addItem} style={{ marginRight: '20px' }}>
          [+] add
        </text>
        <text id='del' bindtap={removeItem}>[-] remove</text>
      </view>
      {items.map((item) => <text key={item} className='item'>{item}</text>)}
      {count % 2 === 0
        ? <text id='even'>even</text>
        : <text id='odd' style={{ color: 'red' }}>odd</text>}
    </view>
  );
}
