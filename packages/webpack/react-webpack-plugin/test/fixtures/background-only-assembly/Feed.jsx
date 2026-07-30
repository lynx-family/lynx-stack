import { useEffect, useState } from '@lynx-js/react';

import { formatFeed } from './heavy-format.js';
import { Shared } from './Shared.jsx';

// A module top-level side effect. Under the in-place strip it still runs on
// the main thread; under the assembly the whole module compiles as a stub
// shell and this statement is dropped from the main-thread bundle — the
// headline behavior change of the assembly implementation.
console.info('FEED_TOP_LEVEL_SIDE_EFFECT_MARKER');

// A heavy leaf component in its own module. The only export carries the
// component-level 'background only' directive, so the module is
// background-only: its element (snapshot) and main-thread-script (worklet)
// definitions reach the main thread through assembly, collected while the
// background compiles this module.
export function Feed() {
  'background only';
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
      <Shared />
      {items.map((it) => <text key={it.id}>{it.label}</text>)}
    </scroll-view>
  );
}
