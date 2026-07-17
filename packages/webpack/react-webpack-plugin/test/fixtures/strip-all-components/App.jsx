import { useEffect, useState } from '@lynx-js/react';

import { formatFeed } from './heavy-format.js';

// A plain component — NO `'background only'` annotation. Under the root-level
// `<Background>` (0.0) whole-program strip, its render body is emptied from the
// main-thread (LEPUS) bundle, while the element (snapshot) and main-thread
// script (worklet) definitions hoisted to module scope survive for hydration.
export function App() {
  const [items] = useState(() => formatFeed(1, 2, 3));
  // A computed value bound dynamically (not a static child, so it is NOT hoisted
  // into the snapshot): it lives in the render body and vanishes when the body
  // is emptied.
  const title = `APP_BODY_LOGIC_MARKER-${items.length}`;
  useEffect(() => {
    console.info('APP_EFFECT_MARKER mounted');
  }, []);
  const onTap = () => {
    console.info('APP_EVENT_MARKER tap');
  };
  const onScroll = (event) => {
    'main thread';
    console.info('SCROLL_WORKLET_MARKER', event.detail.scrollTop);
  };
  return (
    <scroll-view bindtap={onTap} main-thread:bindscroll={onScroll}>
      <text>{title}</text>
      {items.map((it) => <text key={it.id}>{it.label}</text>)}
    </scroll-view>
  );
}
