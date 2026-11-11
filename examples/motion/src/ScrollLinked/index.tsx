// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the root directory of this source tree.

import '@lynx-js/preact-devtools';
import '@lynx-js/react/debug';
import { root } from '@lynx-js/react';

import ScrollLinkedExample from './Deck.js';

root.render(<ScrollLinkedExample />);

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept();
}
