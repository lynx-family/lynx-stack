import { useState } from '@lynx-js/react';

const items = Array.from({ length: 20 }, (_, index) => ({
  id: `item-${index}`,
  title: `Row ${index}`,
}));

export function Feed() {
  // The other end of the dial. `<Background>` defers this subtree at runtime;
  // the directive keeps its render body out of the main-thread bundle too, so
  // the island does not drag the feed's code along. Its element definitions
  // are still retained — the hydration needs them to build the real content.
  'background only';

  const [selected, setSelected] = useState('none');

  return (
    <view className='Feed'>
      <text className='Description'>Selected: {selected}</text>
      <list list-type='single' className='FeedList'>
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
