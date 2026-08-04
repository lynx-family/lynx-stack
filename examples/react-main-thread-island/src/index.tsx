import { MainThread, root } from '@lynx-js/react';

import { Shell } from './Shell.jsx';

root.render(
  // The island is the first frame. Everything the main thread paints before
  // the background exists comes from `<Shell>`, which the build compiles for
  // the main thread because this boundary keeps referencing it — while the
  // `<Background>` inside it folds away, so the deferred code never gets
  // there.
  <MainThread>
    <Shell />
  </MainThread>,
);

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept();
}
