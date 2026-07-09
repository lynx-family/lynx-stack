import '@lynx-js/react/debug';
import { Fragment } from 'react';

import { root } from '@lynx-js/react';

import { App } from './App.js';

import './index.css';

root.render(
  // biome-ignore lint/style/useFragmentSyntax: Just to demonstrate import react is external
  <Fragment>
    <App />,
  </Fragment>,
);

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept();
}
