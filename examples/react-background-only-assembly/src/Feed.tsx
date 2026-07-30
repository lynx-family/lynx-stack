import { useCallback, useState } from '@lynx-js/react';
import type { MainThread } from '@lynx-js/types';

import { formatFeed } from './format.js';

// Every export of this module carries the component-level 'background only'
// directive, so the whole module compiles as a main-thread stub shell. Its
// render logic — and the logic-only `./format.js` module it calls — stay off
// the main thread; the element (snapshot) and main-thread-script (worklet)
// definitions below arrive there through assembly.
export function Feed() {
  'background only';
  const [items] = useState(() => formatFeed(40));
  const [selected, setSelected] = useState('none');

  const onScroll = useCallback((e: MainThread.TouchEvent) => {
    'main thread';
    console.info('feed scrolled', e.detail);
  }, []);

  return (
    <view className='Feed'>
      <text className='Description'>Selected: {selected}</text>
      <list
        list-type='single'
        className='Feed__list'
        main-thread:bindscroll={onScroll}
      >
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
