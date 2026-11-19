// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { options } from 'preact';

import type { RootContext } from '../../render-context.js';
import { getCurrentRootContext, switchRootContext } from '../../render-context.js';
import { PARENT_DOM, RENDER_COMPONENT } from '../../shared/render-constants.js';
import { hook } from '../../utils.js';

const onRenderComponentHook = <T extends unknown[]>(
  old: ((...args: T) => void) | undefined,
  ...args: T
) => {
  const component = args[1] as { [PARENT_DOM]?: { __rootCtx?: RootContext } } | undefined;
  const ctx = component?.[PARENT_DOM]?.__rootCtx;
  if (ctx) {
    switchRootContext(ctx);
  }
  if (old) old(...args);
};

let installed = false;

export function installContextSwitchHook(): void {
  if (installed) {
    return;
  }
  installed = true;
  hook(options, RENDER_COMPONENT, onRenderComponentHook);
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const debounce = options.debounceRendering ?? ((cb: () => void) => void Promise.resolve().then(cb));
  options.debounceRendering = (cb) =>
    debounce(() => {
      const prev = getCurrentRootContext();
      try {
        cb();
      } finally {
        switchRootContext(prev);
      }
    });
}
