// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { cloneElement as preactCloneElement } from 'preact/compat';

import { cloneElement as mainThreadCloneElement } from '../lepus/index.js';

export const cloneElement: typeof import('preact/compat').cloneElement = /*#__PURE__*/ (() => {
  if (__BACKGROUND__) {
    return preactCloneElement;
  } else {
    return mainThreadCloneElement;
  }
})();
