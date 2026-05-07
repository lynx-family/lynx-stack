// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { resetElementTemplatePatchListener } from './patch-listener.js';
import { elementTemplateRegistry } from '../runtime/template/registry.js';

export function installOnMtsDestruction(): void {
  lynx.getNative?.().addEventListener('__DestroyLifetime', onMtsDestruction);
}

export function onMtsDestruction(): void {
  const performance = lynx.performance;
  performance?.profileStart?.('ReactLynx::onMtsDestruction');
  try {
    destroyElementTemplateMainThreadRuntime();
  } finally {
    performance?.profileEnd?.();
    lynx.getNative?.().removeEventListener('__DestroyLifetime', onMtsDestruction);
  }
}

export function destroyElementTemplateMainThreadRuntime(): void {
  let patchListenerResetError: unknown;
  let didPatchListenerResetThrow = false;
  try {
    resetElementTemplatePatchListener();
  } catch (error) {
    patchListenerResetError = error;
    didPatchListenerResetThrow = true;
  }

  // The registry is the main-thread strong-reference owner for ET refs. Clear it
  // even if listener reset fails so destroy does not leave removed pages retained.
  elementTemplateRegistry.clear();

  if (didPatchListenerResetThrow) {
    throw patchListenerResetError;
  }
}
