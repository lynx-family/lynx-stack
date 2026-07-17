import { Background, root } from '@lynx-js/react';

import { App } from './App.jsx';

// A root-level <Background> (0.0 first screen) over an App that DELEGATES to
// components living in other modules — the realistic multi-module shape a
// whole-program strip must keep hydratable. Emptying App's body must not
// sever its references to <Feed/> / <UI.Card/>: those modules carry the
// snapshot/worklet definitions the main thread builds the real tree from.
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
