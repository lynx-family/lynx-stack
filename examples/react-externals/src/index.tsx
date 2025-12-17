import '@lynx-js/react/debug';
import { root } from '@lynx-js/react';

import { App } from './App.js';

// We have to manually import the css now
// TODO: load css from external bundle
// when it is supported in Lynx engine
import './App.css';

root.render(
  <App />,
);

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept();
}
