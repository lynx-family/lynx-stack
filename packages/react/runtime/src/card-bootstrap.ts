// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { ReactLynxRoot } from './root-instance.js';
import type { CreateRootOptions } from './root-instance.js';

let bootstrappedRoot: ReactLynxRoot | undefined;

/**
 * Bind the shared runtime to the card currently being loaded, so the classic
 * `root.render` renders into that card's own root, wired to its native
 * channels. Called once from each card's entry with the card's own
 * `lynx` / `lynxCoreInject` (glue that a build plugin will generate).
 *
 * Calling without options clears the binding, restoring the classic
 * singleton behavior.
 *
 * @internal
 */
export function __bootstrapCard(options?: CreateRootOptions): ReactLynxRoot | undefined {
  if (typeof __BACKGROUND__ !== 'undefined' && __BACKGROUND__) {
    bootstrappedRoot = options ? new ReactLynxRoot(options) : undefined;
  }
  return bootstrappedRoot;
}

/**
 * @internal
 */
export function getBootstrappedRoot(): ReactLynxRoot | undefined {
  return bootstrappedRoot;
}
