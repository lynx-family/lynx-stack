// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { resetElementTemplatePatchListener } from './patch-listener.js';
import { resetElementTemplateRefInitValueListener } from '../main-thread-ref-init-value.js';
import { destroyAllElementTemplateListStates } from '../runtime/list/list.js';
import { resetTemplateId } from '../runtime/template/handle.js';
import {
  disposeElementTemplateMainThreadBackgroundFunctionRuntime,
  resetElementTemplateMainThreadBackgroundFunctionRuntime,
} from '../runtime/template/main-thread-background-function.js';
import { clearMainThreadDynamicAttrState } from '../runtime/template/main-thread-dynamic-attr-state.js';
import { elementTemplateRegistry } from '../runtime/template/registry.js';

export function installOnMtsDestruction(): void {
  lynx.getNative?.().addEventListener('__DestroyLifetime', onMtsDestruction);
}

export function onMtsDestruction(): void {
  teardownOnMtsDestruction('destroy');
}

export function retireElementTemplateMainThreadForReload(): void {
  teardownOnMtsDestruction('reload');
}

function teardownOnMtsDestruction(mode: 'destroy' | 'reload'): void {
  const performance = lynx.performance;
  performance?.profileStart?.('ReactLynx::onMtsDestruction');
  try {
    destroyElementTemplateMainThreadRuntime(mode);
  } finally {
    performance?.profileEnd?.();
    lynx.getNative?.().removeEventListener('__DestroyLifetime', onMtsDestruction);
  }
}

export function destroyElementTemplateMainThreadRuntime(
  mode: 'destroy' | 'reload' = 'destroy',
): void {
  let patchListenerResetError: unknown;
  let didPatchListenerResetThrow = false;
  try {
    resetElementTemplatePatchListener();
  } catch (error) {
    patchListenerResetError = error;
    didPatchListenerResetThrow = true;
  }

  resetElementTemplateRefInitValueListener();

  // The registry is the main-thread strong-reference owner for ET refs. Clear it
  // even if listener reset fails so destroy does not leave removed pages retained.
  destroyAllElementTemplateListStates();
  elementTemplateRegistry.clear();
  try {
    clearMainThreadDynamicAttrState();
  } finally {
    if (mode === 'reload') {
      resetElementTemplateMainThreadBackgroundFunctionRuntime();
    } else {
      disposeElementTemplateMainThreadBackgroundFunctionRuntime();
    }
    resetTemplateId();
  }

  if (didPatchListenerResetThrow) {
    throw patchListenerResetError;
  }
}
