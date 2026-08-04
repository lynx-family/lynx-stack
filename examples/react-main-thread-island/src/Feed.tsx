import { useState } from '@lynx-js/react';

const items = Array.from({ length: 20 }, (_, index) => ({
  id: `item-${index}`,
  title: `Row ${index}`,
}));

// The other end of the dial. The `<Background>` that wraps this component in
// `Shell` is folded to its fallback for the main thread, so neither this
// module nor anything it imports reaches the main-thread bundle — while its
// element definitions still travel there, because the hydration needs them to
// build the real content.
export function Feed() {
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
