// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
// Rspeedy aliases this fixture-only devtools package during bundling.
// eslint-disable-next-line import/no-unresolved
import '@lynx-js/preact-devtools';
import '@lynx-js/react/debug';

import { root } from '@lynx-js/react';

import { App } from './App.jsx';

root.render(
  <App />,
);

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept();
}
