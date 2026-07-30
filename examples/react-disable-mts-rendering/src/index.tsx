import { Background, root } from '@lynx-js/react';

import { App } from './App.jsx';

root.render(
  <Background
    fallback={
      <view style='padding:32px'>
        <text>Loading…</text>
      </view>
    }
  >
    <App />
  </Background>,
);

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept();
}
