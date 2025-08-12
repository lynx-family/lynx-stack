// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createElement as preactCreateElement } from 'preact/compat';

import { createElement as mainThreadCreateElement } from '../lepus/index.js';

export const createElement: typeof import('preact/compat').createElement = /*#__PURE__*/ (() => {
  if (__BACKGROUND__) {
    return preactCreateElement;
  } else {
    return mainThreadCreateElement;
  }
})();
