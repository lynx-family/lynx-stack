// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { options } from 'preact';

import type { RootContext } from '../../root-context.js';
import { switchRootContext } from '../../root-context.js';
import { PARENT_DOM, RENDER_COMPONENT } from '../../shared/render-constants.js';
import { hook } from '../../utils.js';

/**
 * Preact processes its re-render queue component by component, and the queue
 * may interleave components belonging to different roots. Each component's
 * diff (which records snapshot patches) and commit run synchronously inside
 * `renderComponent`, so re-establishing the owner's context right before it
 * is enough to keep every root's state isolated.
 *
 * The owner is recovered from the component's parent DOM: on the background
 * thread that is a `BackgroundSnapshotInstance`, stamped with its
 * `__rootCtx` at construction. Main thread instances carry no stamp, so this
 * hook is a no-op there.
 */
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

hook(options, RENDER_COMPONENT, onRenderComponentHook);
