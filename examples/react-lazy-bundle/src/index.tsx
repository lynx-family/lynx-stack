import '@lynx-js/preact-devtools';
import '@lynx-js/react/debug';
import { root } from '@lynx-js/react';

import { App } from './App.jsx';

void import('./utils/minus.js').then((res) => {
  console.info('dynamic import minus', res.minus(1, 2));
});

root.render(
  <App />,
);

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept();
}
