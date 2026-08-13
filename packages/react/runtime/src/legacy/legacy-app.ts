// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * ReactLynx 2 class-component compat only.
 *
 * The legacy internals (`_nativeApp`, `_reactLynx.ReactComponent`) live on
 * the app object lynx-core injects for RL2 bundles and have no sanctioned
 * accessor. Every remaining read of that injected global in this runtime is
 * confined to this module; nothing on the active (RL3 / multi-root) path
 * may import it.
 */
export function getLegacyInjectedApp(): unknown {
  return (globalThis as { lynxCoreInject?: { tt?: unknown } }).lynxCoreInject
    ?.tt;
}
