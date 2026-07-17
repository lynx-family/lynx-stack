import { useEffect, useState } from '@lynx-js/react';

import { formatFeed } from './heavy-format.js';

// Definition-site opt-out: this component's render never runs on the main
// thread, so its body is stripped from the main-thread (LEPUS) bundle while
// its element/worklet definitions (hoisted to module scope before the strip)
// are retained for hydration.
export function Feed() {
  'background only';
  const [items] = useState(() => formatFeed(1, 2, 3));
  useEffect(() => {
    console.log('FEED_RENDER_LOGIC_MARKER mounted');
  }, []);
  const onTap = () => {
    console.log('FEED_RENDER_LOGIC_MARKER tap');
  };
  const onScroll = (event) => {
    'main thread';
    console.log('SCROLL_WORKLET_MARKER', event.detail.scrollTop);
  };
  return (
    <scroll-view bindtap={onTap} main-thread:bindscroll={onScroll}>
      {items.map((it) => <text key={it.id}>{it.label}</text>)}
    </scroll-view>
  );
}
