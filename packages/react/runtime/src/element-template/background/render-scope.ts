// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { options } from 'preact';

import { CATCH_ERROR, RENDER_COMPONENT, ROOT } from '../../shared/render-constants.js';
import { hook, lynxQueueMicrotask } from '../../utils.js';
import { discardPendingRefAttachments } from '../prop-adapters/ref.js';

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

  hook(options, RENDER_COMPONENT, onPreactRenderHook);
  hook(options, ROOT, onPreactRenderHook);
  hook(options, CATCH_ERROR, (old, ...args) => {
    try {
      old!(...args);
    } catch (error) {
      if (__BACKGROUND__ && elementTemplateRendering) {
        // Error boundaries and Suspense return through the original hook. Only
        // an unhandled render must lose its pending attaches; old refs still
        // need their queued cleanup even if Preact abandons their host VNodes.
        discardPendingRefAttachments();
        clearElementTemplateRenderScope();
      }
      throw error;
    }
  });
}

function onPreactRenderHook<T extends unknown[]>(old: ((...args: T) => void) | undefined, ...args: T): void {
  old?.(...args);
  if (__BACKGROUND__) {
    markPreactRenderInProgress();
  }
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
