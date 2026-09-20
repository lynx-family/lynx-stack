// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { options } from 'preact';

import { RENDER_COMPONENT, ROOT } from '../../shared/render-constants.js';
import { lynxQueueMicrotask } from '../../utils.js';

export const isRendering = /* @__PURE__ */ { value: false };

const setIsRendering = () => {
  isRendering.value = true;
  // Make sure `isRendering` is set to false even if an error is thrown during rendering
  lynxQueueMicrotask(() => {
    isRendering.value = false;
  });
};

// eslint-disable-next-line @typescript-eslint/unbound-method
const oldRenderComponent = options[RENDER_COMPONENT];
options[RENDER_COMPONENT] = (vnode, component) => {
  /* v8 ignore next */
  oldRenderComponent?.(vnode, component);
  setIsRendering();
};

// eslint-disable-next-line @typescript-eslint/unbound-method
const oldRoot = options[ROOT];
options[ROOT] = (vnode, parent) => {
  /* v8 ignore next */
  oldRoot?.(vnode, parent);
  setIsRendering();
};
