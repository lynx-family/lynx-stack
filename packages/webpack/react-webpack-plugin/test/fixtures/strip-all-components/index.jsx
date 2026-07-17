import { Background, root } from '@lynx-js/react';

import { App } from './App.jsx';

// A root-level `<Background>` declares a 0.0 first screen: the whole first
// frame is the static `fallback`, and NOTHING renders on the main thread. The
// fallback is composed of host elements only (no user components), because the
// strip empties every component body from the main-thread bundle.
root.render(
  <Background
    fallback={
      <view>
        <text>LOADING_FALLBACK_MARKER</text>
      </view>
    }
  >
    <App />
  </Background>,
);
