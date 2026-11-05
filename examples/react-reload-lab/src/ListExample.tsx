import { useState } from '@lynx-js/react';

import './ListExample.css';

const initialItems = Array.from({ length: 40 }, (_, index) => index + 1);

export function ListExample({ onReload }: { onReload: () => void }) {
  const [items, setItems] = useState(initialItems);
  const [selected, setSelected] = useState<number | null>(null);
  const [tapCount, setTapCount] = useState(0);

  function selectItem(id: number) {
    'background-only';
    setSelected(id);
    setTapCount(count => count + 1);
  }

  return (
    <view className='ListExample'>
      <text className='ListExampleTitle'>List reload</text>
      <text className='ListExampleHint'>
        Scroll, tap rows, change their order, then reload. React state should
        reset and rows should remain clickable.
      </text>
      <text className='ListExampleStatus'>
        {`Rows: ${items.length} · Selected: ${
          selected ?? 'none'
        } · Taps: ${tapCount}`}
      </text>
      <view className='ListExampleActions'>
        <view
          className='ListExampleButton'
          bindtap={() => setItems(current => [...current].reverse())}
        >
          <text className='ListExampleButtonText'>Reverse</text>
        </view>
        <view
          className='ListExampleButton'
          bindtap={() => setItems(current => current.slice(1))}
        >
          <text className='ListExampleButtonText'>Remove first</text>
        </view>
        <view className='ListExampleButton' bindtap={onReload}>
          <text className='ListExampleButtonText'>Reload</text>
        </view>
      </view>
      <list className='ListExampleFeed' list-type='single'>
        {items.map(id => (
          <list-item
            key={id}
            item-key={`reload-row-${id}`}
            reuse-identifier='reload-row'
            className='ListExampleRow'
            bindtap={() => selectItem(id)}
          >
            <text className='ListExampleRowText'>
              {`Row ${id}${selected === id ? ' · selected' : ''}`}
            </text>
          </list-item>
        ))}
      </list>
    </view>
  );
}
