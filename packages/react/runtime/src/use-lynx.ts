// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { getCurrentRootContext } from './root-context.js';
import type { RootLynx } from './root-context.js';

/**
 * Returns the `lynx` object of the page this component belongs to.
 *
 * With the runtime shared across cards, the global `lynx` is bound to the
 * first card that evaluated the chunk. Components must not read it directly;
 * this hook resolves the instance the current root was created with
 * (`createRoot({ lynx })`), falling back to the global for single-card apps.
 *
 * The instance is fixed for the lifetime of a root, so this is a plain read
 * — it never triggers re-renders.
 *
 * @public
 */
export function useLynx(): RootLynx {
  return getCurrentRootContext().lynx ?? lynx;
}
