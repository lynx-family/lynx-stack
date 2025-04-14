// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { SnapshotPatch } from './snapshotPatch.js';
import { SnapshotOperation } from './snapshotPatch.js';
import { SnapshotInstance, createSnapshot, snapshotInstanceManager, snapshotManager } from '../../snapshot.js';

function reportCtxNotFound(): void {
  lynx.reportError(new Error(`snapshotPatchApply failed: ctx not found`));
}

export function snapshotPatchApply(snapshotPatch: SnapshotPatch): void {
  const length = snapshotPatch.length;
  for (let i = 0; i < length; ++i) {
    switch (snapshotPatch[i]) {
      case SnapshotOperation.CreateElement: {
        const type = snapshotPatch[++i];
        const id = snapshotPatch[++i];
        new SnapshotInstance(type, id);
        break;
      }
      case SnapshotOperation.InsertBefore: {
        const parentId = snapshotPatch[++i];
        const childId = snapshotPatch[++i];
        const beforeId = snapshotPatch[++i];
        const parent = snapshotInstanceManager.values.get(parentId);
        const child = snapshotInstanceManager.values.get(childId);
        const existingNode = snapshotInstanceManager.values.get(beforeId);
        if (!parent || !child) {
          reportCtxNotFound();
        } else {
          parent.insertBefore(child, existingNode);
        }
        break;
      }
      case SnapshotOperation.RemoveChild: {
        const parentId = snapshotPatch[++i];
        const childId = snapshotPatch[++i];
        const parent = snapshotInstanceManager.values.get(parentId);
        const child = snapshotInstanceManager.values.get(childId);
        if (!parent || !child) {
          reportCtxNotFound();
        } else {
          parent.removeChild(child);
        }
        break;
      }
      case SnapshotOperation.SetAttribute: {
        const id = snapshotPatch[++i];
        const dynamicPartIndex = snapshotPatch[++i];
        const value = snapshotPatch[++i];
        const si = snapshotInstanceManager.values.get(id);
        if (si) {
          si.setAttribute(dynamicPartIndex, value);
        } else {
          reportCtxNotFound();
        }
        break;
      }
      case SnapshotOperation.SetAttributes: {
        const id = snapshotPatch[++i];
        const values = snapshotPatch[++i];
        const si = snapshotInstanceManager.values.get(id);
        if (si) {
          si.setAttribute('values', values);
        } else {
          reportCtxNotFound();
        }
        break;
      }
      case SnapshotOperation.DEV_ONLY_AddSnapshot: {
        if (__DEV__) {
          const uniqID: string = snapshotPatch[++i];
          const create: string = snapshotPatch[++i];
          const update: string[] = snapshotPatch[++i];
          const slot = snapshotPatch[++i];
          const cssId: number = snapshotPatch[++i] ?? 0;
          const entryName: string | undefined = snapshotPatch[++i];

          if (!snapshotManager.values.has(uniqID)) {
            // HMR-related
            // Update the evaluated snapshots from JS.
            createSnapshot(
              uniqID,
              evaluate<(ctx: SnapshotInstance) => FiberElement[]>(create),
              update.map<(ctx: SnapshotInstance, index: number, oldValue: any) => void>(evaluate),
              slot,
              cssId,
              entryName,
            );
          }
        }
        break;
      }
        // case SnapshotOperation.DEV_ONLY_RegisterWorklet: {
        //   // HMR-related
        //   if (__DEV__) {
        //     const hash: string = snapshotPatch[++i];
        //     const fnStr: string = snapshotPatch[++i];
        //     const fn = evaluate<(ctx: SnapshotInstance) => FiberElement[]>(fnStr);
        //     registerWorklet('main-thread', hash, fn);
        //   }
        //   break;
        // }
    }
  }
}

/**
 * Given an expression string, return the evaluated result with ReactLynx runtime injected.
 *
 * @param code - The code to be evaluated
 * @returns the evaluated expression
 */
function evaluate<T>(code: string): T {
  return new Function(`return ${code}`)();
}
