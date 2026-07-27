import { Suspense, lazy, useCallback, useState } from '@lynx-js/preact-runtime';

const LazyThing = lazy(() => import('./LazyThing.js'));

export function App() {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<string[]>([]);
  const [showLazy, setShowLazy] = useState(false);

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
      <text
        id='mt'
        main-thread:bindtap={(e: {
          currentTarget: {
            setStyleProperty(name: string, value: string): void;
          };
        }) => {
          e.currentTarget.setStyleProperty('color', 'green');
          e.currentTarget.setStyleProperty('font-weight', 'bold');
        }}
      >
        MT: tap to turn green
      </text>
      <view id='lazybtn' bindtap={() => setShowLazy((v) => !v)}>
        <text id='lazylabel'>{showLazy ? 'hide lazy' : 'show lazy'}</text>
      </view>
      <Suspense fallback={<text>loading lazy...</text>}>
        {showLazy ? <LazyThing /> : <text id='nolazy'>no panel</text>}
      </Suspense>
      <list
        id='rows'
        style={{ height: '120px', width: '300px', marginTop: '10px' }}
        list-type='single'
        span-count={1}
      >
        {items.map((item) => (
          <list-item item-key={item} key={item}>
            <text>{`row of ${item}`}</text>
          </list-item>
        ))}
      </list>
    </view>
  );
}
