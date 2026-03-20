// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * MTC Renderer — handles mount/update/unmount of MTC Preact islands.
 *
 * Each MTC island is a self-contained Preact render tree on the main thread.
 * The renderer reads patch operations and delegates to the component registry.
 */

import { wrapWithErrorHandling } from './errorBoundary.js';
import { adoptSlotChildren } from './slot.js';
import type { MTCComponentFactory, MTCInstance } from './types.js';

/** Registry of MTC component factories, keyed by component hash */
const componentRegistry = new Map<string, MTCComponentFactory>();

/** Active MTC instances, keyed by snapshot instance ID */
const instanceMap = new Map<number, MTCInstance>();

/**
 * Register an MTC component factory.
 * Called from compiled Lepus code: `registerMTC(hash, factory)`
 */
export function registerMTCComponent(hash: string, factory: MTCComponentFactory): void {
  componentRegistry.set(hash, factory);
}

/**
 * Handle MtcMount patch operation.
 * Patch format: [MtcMount, snapshotInstanceId, componentHash, propsValues]
 * @returns the new index position after consuming params
 */
export function handleMount(
  patch: unknown[],
  i: number,
  snapshotInstanceValues: Map<number, { __element_root?: unknown }>,
): number {
  const snapshotInstanceId = patch[++i] as number;
  const componentHash = patch[++i] as string;
  const propsValues = (patch[++i] ?? {}) as Record<string, unknown>;

  const factory = componentRegistry.get(componentHash);
  if (!factory) {
    if (__DEV__) {
      console.warn(`[MTC] Component not found for hash: ${componentHash}`);
    }
    return i;
  }

  // Look up the container element from the snapshot instance
  const snapshotInstance = snapshotInstanceValues.get(snapshotInstanceId);
  if (!snapshotInstance) {
    if (__DEV__) {
      console.warn(`[MTC] Snapshot instance not found for ID: ${snapshotInstanceId}`);
    }
    return i;
  }

  const container = snapshotInstance.__element_root;

  wrapWithErrorHandling(componentHash, () => {
    // Render the MTC component
    factory(propsValues);

    // Adopt slot children if any
    const slotIds = propsValues.__mtcSlotIds as number[] | undefined;
    if (slotIds) {
      adoptSlotChildren(container, slotIds, snapshotInstanceValues);
    }

    const instance: MTCInstance = {
      componentHash,
      container,
      snapshotInstanceId,
      props: propsValues,
      cleanup: () => {
        // Cleanup: call factory with null to unmount
        try {
          factory(null as unknown as Record<string, unknown>);
        } catch {
          // Swallow cleanup errors
        }
        instanceMap.delete(snapshotInstanceId);
      },
    };

    instanceMap.set(snapshotInstanceId, instance);
  });

  return i;
}

/**
 * Handle MtcUpdate patch operation.
 * Patch format: [MtcUpdate, snapshotInstanceId, propsValues]
 * @returns the new index position after consuming params
 */
export function handleUpdate(
  patch: unknown[],
  i: number,
  _snapshotInstanceValues: Map<number, { __element_root?: unknown }>,
): number {
  const snapshotInstanceId = patch[++i] as number;
  const propsValues = (patch[++i] ?? {}) as Record<string, unknown>;

  const instance = instanceMap.get(snapshotInstanceId);
  if (!instance) {
    if (__DEV__) {
      console.warn(`[MTC] Instance not found for update, ID: ${snapshotInstanceId}`);
    }
    return i;
  }

  const factory = componentRegistry.get(instance.componentHash);
  if (!factory) {
    return i;
  }

  wrapWithErrorHandling(instance.componentHash, () => {
    factory(propsValues);
    instance.props = propsValues;
  });

  return i;
}

/**
 * Handle MtcUnmount patch operation.
 * Patch format: [MtcUnmount, snapshotInstanceId]
 * @returns the new index position after consuming params
 */
export function handleUnmount(
  patch: unknown[],
  i: number,
  _snapshotInstanceValues: Map<number, { __element_root?: unknown }>,
): number {
  const snapshotInstanceId = patch[++i] as number;

  const instance = instanceMap.get(snapshotInstanceId);
  if (instance) {
    instance.cleanup();
  }

  return i;
}

/**
 * Clean up all MTC instances. Called on page destroy.
 */
export function cleanupAllInstances(): void {
  for (const [, instance] of instanceMap) {
    instance.cleanup();
  }
  instanceMap.clear();
}

/** Exposed for testing */
export { componentRegistry, instanceMap };
