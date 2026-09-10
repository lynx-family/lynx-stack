import '@lynx-js/react/debug';
import { Fragment } from 'react';

import { root } from '@lynx-js/react';

import { App } from './App.js';

import './index.css';

function logTapHint() {
  'background only';
  void import('./utils.js').then(({ formatTapCount }) => {
    console.info(formatTapCount(0));
  });
}

logTapHint();

root.render(
  // biome-ignore lint/style/useFragmentSyntax: Just to demonstrate import react is external
  <Fragment>
    <App />,
  </Fragment>,
);

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept();
}
