// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Slot child adoption for MTC components.
 *
 * When an MTC component receives BTC children (slots), those children
 * are created as normal snapshot instances by earlier patch operations.
 * The MTC mount handler reads slot element IDs from props and adopts
 * them into the MTC container via __AppendElement().
 *
 * This is synchronous — no microtask hack needed because the patch
 * list is ordered by the compiler: slot children are created before
 * MtcMount fires.
 */

/**
 * Adopt slot children into an MTC container element.
 * @param container - The MTC container element
 * @param slotIds - Array of snapshot instance IDs to adopt
 * @param snapshotInstanceValues - The snapshot instance manager values map
 */
export function adoptSlotChildren(
  container: unknown,
  slotIds: number[] | undefined,
  snapshotInstanceValues: Map<number, { __element_root?: unknown }>,
): void {
  if (!slotIds || slotIds.length === 0) {
    return;
  }

  for (const id of slotIds) {
    const instance = snapshotInstanceValues.get(id);
    if (instance?.__element_root) {
      __AppendElement(container, instance.__element_root);
    } else if (__DEV__) {
      console.warn(`[MTC] Slot child not found for ID: ${id}`);
    }
  }
}
