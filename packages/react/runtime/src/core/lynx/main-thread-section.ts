// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Kept side-effect free: `snapshot/` imports this without pulling in
// `lazy-bundle.ts`'s `lynx.loadLazyBundle` registration.
const SECTION_MAIN_THREAD = 'main-thread';

/**
 * Evaluate a bundle's main-thread section. The FetchBundle shell is a
 * parameterless self-invoking IIFE whose completion value is its exports
 * (`return module.exports`), so the eval result is the exports directly.
 *
 * Returns `undefined` when the bundle has no main-thread section (BG-only).
 *
 * @internal
 */
export function loadMainThreadSection(bundleName: string): unknown {
  try {
    return lynx.loadScript<unknown>(SECTION_MAIN_THREAD, { bundleName });
  } catch {
    return undefined;
  }
}
