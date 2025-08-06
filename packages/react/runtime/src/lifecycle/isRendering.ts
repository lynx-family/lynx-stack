// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { options } from 'preact';

import { RENDER_COMPONENT, ROOT } from '../renderToOpcodes/constants.js';
import { hook, lynxQueueMicrotask } from '../utils.js';

export const isRendering = /* @__PURE__ */ { value: false };

const setIsRendering = () => {
  isRendering.value = true;
  // Make sure `isRendering` is set to false even if an error is thrown during rendering
  lynxQueueMicrotask(() => {
    isRendering.value = false;
  });
};

hook(options, RENDER_COMPONENT, (old, ...args) => {
  /* v8 ignore next */
  old?.(...args);
  setIsRendering();
});

hook(options, ROOT, (old, ...args) => {
  /* v8 ignore next */
  old?.(...args);
  setIsRendering();
});
