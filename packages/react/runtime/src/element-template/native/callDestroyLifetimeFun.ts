// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { takeMainThreadRefInitValuePatch } from '../../core/main-thread-ref-init-value.js';
import { resetElementTemplateCommitState } from '../background/commit-hook.js';
import { destroyElementTemplateBackgroundRuntime } from '../background/destroy.js';
import { __root } from '../runtime/page/root-instance.js';

export function callDestroyLifetimeFun(): void {
  takeMainThreadRefInitValuePatch();
  if (typeof __EXPERIMENTAL_RE_EVAL_JS_ON_RELOAD__ !== 'undefined' && __EXPERIMENTAL_RE_EVAL_JS_ON_RELOAD__) {
    // Native reload already retired the old tree. Do not send its unmount
    // operations to the new main-thread runtime.
    resetElementTemplateCommitState();
  }
  destroyElementTemplateBackgroundRuntime();
  if (typeof __EXPERIMENTAL_RE_EVAL_JS_ON_RELOAD__ !== 'undefined' && __EXPERIMENTAL_RE_EVAL_JS_ON_RELOAD__) {
    __root.__jsx = undefined;
    Reflect.deleteProperty(lynx, Symbol.for('__LYNX_EXTERNAL_GLOBAL__'));
  }
}
