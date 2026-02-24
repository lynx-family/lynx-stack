import '@lynx-js/react/debug';
import { root } from '@lynx-js/react';

import { App } from './App.js';

import './index.css';

root.render(
  <App />,
);

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept();
}
