// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Type definitions for snapshot system.
 */

export type SnapshotType = string | null;

/**
 * Interface for objects that have child nodes.
 */
export interface WithChildren {
  childNodes: WithChildren[];
}

/**
 * Serialized snapshot instance for communication between threads.
 */
export interface SerializedSnapshotInstance {
  id: number;
  type: SnapshotType;
  values?: any[] | undefined;
  __listItemPlatformInfo?: unknown;
  extraProps?: Record<string, unknown> | undefined;
  children?: SerializedSnapshotInstance[] | undefined;
  slotIndex?: number | undefined;
}
