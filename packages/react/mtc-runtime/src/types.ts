// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * A factory function that creates a Preact VNode for an MTC component.
 */
export type MTCComponentFactory = (props: Record<string, unknown>) => unknown;

/**
 * Tracks a mounted MTC island instance.
 */
export interface MTCInstance {
  /** The component hash used to look up the factory */
  componentHash: string;
  /** The container element for this MTC island */
  container: unknown;
  /** The snapshot instance ID */
  snapshotInstanceId: number;
  /** Current props */
  props: Record<string, unknown>;
  /** Cleanup function: unmounts Preact tree */
  cleanup: () => void;
}
