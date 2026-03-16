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
} as const;

export type DynamicPartType = (typeof DynamicPartType)[keyof typeof DynamicPartType];
