// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Types of dynamic parts that can be updated in a snapshot
 * These are determined at compile time through static analysis
 */
export const enum DynamicPartType {
  Attr = 0, // Regular attribute updates
  Spread, // Spread operator in JSX
  Slot, // Slot for component children
  Children, // Regular children updates
  ListChildren, // List/array children updates
  MultiChildren, // Multiple children updates (compat layer)
}
