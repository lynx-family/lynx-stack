// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Types of dynamic parts that can be updated in a snapshot
 * These are determined at compile time through static analysis
 */
export const DynamicPartType = {
  Attr: 0, // Regular attribute updates
  Spread: 1, // Spread operator in JSX
  Slot: 2, // Slot for component children
  Children: 3, // Regular children updates
  ListChildren: 4, // List/array children updates
  MultiChildren: 5, // Multiple children updates (compat layer)
  SlotV2: 6, // Slot for component children (Preact MultiSlots)
  ListSlotV2: 7, // List/array children updates (Preact MultiSlots)
} as const;

export type DynamicPartType = (typeof DynamicPartType)[keyof typeof DynamicPartType];

/**
 * Default dynamic part for children
 */
export const __DynamicPartChildren_0: [DynamicPartType, number][] = [[DynamicPartType.Children, 0]];

/**
 * Default dynamic part for list children
 */
export const __DynamicPartListChildren_0: [DynamicPartType, number][] = [[DynamicPartType.ListChildren, 0]];

/**
 * Dynamic part for slot v2
 */
export const __DynamicPartSlotV2_0: [DynamicPartType, number][] = [[DynamicPartType.SlotV2, 0]];

/**
 * Dynamic part for list slot v2
 */
export const __DynamicPartListSlotV2_0: [DynamicPartType, number][] = [[DynamicPartType.ListSlotV2, 0]];
