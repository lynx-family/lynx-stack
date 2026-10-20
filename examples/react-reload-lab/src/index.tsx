import { root } from '@lynx-js/react';

import { App } from './App.jsx';
import { installElementPapiInterceptor } from './element-papi-trace.js';

if (typeof __MAIN_THREAD__ !== 'undefined' && __MAIN_THREAD__) {
  installElementPapiInterceptor();
}

root.render(<App />);

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept();
}
