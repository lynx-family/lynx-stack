import '@lynx-js/preact-devtools';
import '@lynx-js/react/debug';
import { root } from '@lynx-js/react';

import { App } from './App.jsx';
import { createProducerBundleUrl } from './entry-url.js';

void import(createProducerBundleUrl('minus.lynx.bundle'), {
  with: {
    type: 'component',
  },
}).then((res: typeof import('./utils/minus.js')) => {
  console.info('dynamic import minus', res.minus(1, 2));
});

root.render(
  <App />,
);

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept();
}
