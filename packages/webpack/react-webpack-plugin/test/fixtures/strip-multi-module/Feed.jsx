import { useEffect, useState } from '@lynx-js/react';

import { formatFeed } from './heavy-format.js';

// A heavy leaf component in its own module, with NO 'background only'
// annotation. Under the whole-program strip its render body is emptied from
// the main-thread bundle, but the element (snapshot) and main-thread-script
// (worklet) definitions hoisted to this module's scope must survive for
// first-screen hydration — which they can only do if the module itself stays
// referenced after the parent's body is emptied.
export function Feed() {
  const [items] = useState(() => formatFeed(1, 2, 3));
  const title = `FEED_BODY_LOGIC_MARKER-${items.length}`;
  useEffect(() => {
    console.info('FEED_EFFECT_MARKER mounted');
  }, []);
  const onScroll = (event) => {
    'main thread';
    console.info('SCROLL_WORKLET_MARKER', event.detail.scrollTop);
  };
  return (
    <scroll-view main-thread:bindscroll={onScroll}>
      <text>FEED_SNAPSHOT_STATIC_MARKER</text>
      <text>{title}</text>
      {items.map((it) => <text key={it.id}>{it.label}</text>)}
    </scroll-view>
  );
}
