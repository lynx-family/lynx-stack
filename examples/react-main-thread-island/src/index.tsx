import { MainThread, root } from '@lynx-js/react';

import { Shell } from './Shell.jsx';

root.render(
  // The island is the first frame. Everything the main thread paints before
  // the background exists comes from `<Shell>`, which is compiled into the
  // main-thread bundle because it carries the `'main thread component'`
  // directive. The `fallback` is what a build that could not compile the
  // island degrades to.
  <MainThread
    fallback={
      <view style='padding:32px'>
        <text>Loading…</text>
      </view>
    }
  >
    <Shell />
  </MainThread>,
);

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept();
}
