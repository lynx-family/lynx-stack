// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { options } from 'preact';

import { RENDER_COMPONENT, ROOT } from '../../shared/render-constants.js';
import { lynxQueueMicrotask } from '../../utils.js';

let installed = false;
let elementTemplateRendering = false;
let renderGeneration = 0;

export function isElementTemplateRendering(): boolean {
  return elementTemplateRendering;
}

export function clearElementTemplateRenderScope(): void {
  elementTemplateRendering = false;
  renderGeneration++;
}

export function resetElementTemplateRenderScope(): void {
  clearElementTemplateRenderScope();
}

export function installElementTemplateRenderScopeHooks(): void {
  if (installed) {
    return;
  }
  installed = true;

  // eslint-disable-next-line @typescript-eslint/unbound-method
  const oldRenderComponent = options[RENDER_COMPONENT];
  options[RENDER_COMPONENT] = (vnode, component) => {
    oldRenderComponent?.(vnode, component);
    if (__BACKGROUND__) {
      markPreactRenderInProgress();
    }
  };

  // eslint-disable-next-line @typescript-eslint/unbound-method
  const oldRoot = options[ROOT];
  options[ROOT] = (vnode, parent) => {
    oldRoot?.(vnode, parent);
    if (__BACKGROUND__) {
      markPreactRenderInProgress();
    }
  };
}

function markPreactRenderInProgress(): void {
  elementTemplateRendering = true;
  const generation = ++renderGeneration;
  lynxQueueMicrotask(() => {
    if (generation === renderGeneration) {
      elementTemplateRendering = false;
    }
  });
}
