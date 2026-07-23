// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { options } from 'preact';

import type { RootContext } from '../../root-context.js';
import { switchRootContext } from '../../root-context.js';
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
  /* v8 ignore next */
  if (old) old(...args);
};

let installed = false;

/**
 * Installs the render-component context switch lazily — only once the first
 * non-default root context is created. The classic single-root path never
 * pays for it.
 *
 * @internal
 */
export function installContextSwitchHook(): void {
  if (installed) {
    return;
  }
  installed = true;
  hook(options, RENDER_COMPONENT, onRenderComponentHook);
}
