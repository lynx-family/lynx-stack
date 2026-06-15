// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  L1ReadOnlyElement,
  L1ReadOnlyNode,
  L2SafeWritableElement,
  L3aEventfulElement,
  L3bUnsafeWritableElement,
} from './nodes.ts';

/**
 * Tier-narrowing runtime helpers. See Shim_Design.md §2 "Tier selection at
 * construction" + OQ-S.6.
 *
 * **OQ-S.6 resolution.**
 * The default helpers in THIS module are type-level casts: the returned
 * value is the same underlying object, narrowed at the TypeScript layer
 * so methods above the chosen tier produce compile errors. There is NO
 * runtime guard.
 *
 * For runtime guards, callers can import the strict variants from
 * `@lynx-js/dom-shim/tiers/strict`. Those wrap the input in a Proxy
 * that throws `DOMShimUnsupportedError` with `code: 'L4/tier-violation'`
 * when a higher-tier method is accessed.
 */

/**
 * Narrow to L1 (ReadOnly). Compile-time check rejects L2+ method calls
 * on the result.
 */
export function ReadOnly<T extends L1ReadOnlyNode>(el: T): L1ReadOnlyElement {
  return el as unknown as L1ReadOnlyElement;
}

/** Narrow to L2 (SafeWrite). */
export function SafeWrite<T extends L1ReadOnlyNode>(
  el: T,
): L2SafeWritableElement {
  return el as unknown as L2SafeWritableElement;
}

/** Narrow to L3a (Events). */
export function Events<T extends L1ReadOnlyNode>(
  el: T,
): L3aEventfulElement {
  return el as unknown as L3aEventfulElement;
}

/** Narrow to L3b (Unsafe). */
export function Unsafe<T extends L1ReadOnlyNode>(
  el: T,
): L3bUnsafeWritableElement {
  return el as unknown as L3bUnsafeWritableElement;
}
