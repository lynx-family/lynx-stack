// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * The main thread drops patches stamped with a reload version older than its
 * own, so both threads have to count the same reloads. Keeping the count on the
 * page realm rather than in this module lets it survive an entry that is
 * evaluated again on reload.
 */
const RELOAD_VERSION: symbol = Symbol.for('__LYNX_RELOAD_VERSION__');

type ReloadVersionHolder = Record<symbol, number | undefined>;

export function getReloadVersion(): number {
  return (globalThis as unknown as ReloadVersionHolder)[RELOAD_VERSION] ?? 0;
}

export function increaseReloadVersion(): number {
  const next = getReloadVersion() + 1;
  (globalThis as unknown as ReloadVersionHolder)[RELOAD_VERSION] = next;
  return next;
}

export { RELOAD_VERSION };
