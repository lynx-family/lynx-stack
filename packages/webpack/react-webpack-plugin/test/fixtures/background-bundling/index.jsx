import { Background, root } from '@lynx-js/react';

import { Feed } from './Feed.jsx';

export function App() {
  return (
    <view>
      <text>Header renders on the first screen (IFR)</text>
      <Background fallback={<text>Loading…</text>}>
        <Feed />
      </Background>
    </view>
  );
}

root.render(<App />);
