// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Implements the patch application logic for the snapshot system.
 * This module is responsible for interpreting and executing patch operations
 * that were generated in the background thread, applying them to the DOM
 * in the main thread.
 *
 * The module handles various operations like element creation, insertion,
 * removal, and attribute updates, ensuring they are applied in the correct
 * order and with proper error handling.
 */

import { sendCtxNotFoundEventToBackground } from './error.js';
import type { SnapshotPatch } from './snapshotPatch.js';
import { SnapshotOperation } from './snapshotPatch.js';
import { SnapshotInstance, snapshotCreatorMap, snapshotInstanceManager } from '../../snapshot/snapshot.js';
import { traverseSnapshotInstance } from '../../snapshot/utils.js';

/**
 * Resolve a serialized NodesRef (the `identifier` string produced by
 * `serializeNodesRef`) to a single host FiberElement on the main thread.
 *
 * The identifier is treated as a CSS selector. This covers:
 *   - `RefProxy.selector` → `[react-ref-X-Y]` (a CSS attribute selector)
 *   - real `NodesRef` from `lynx.createSelectorQuery().select('#foo')`
 *
 * UNIQUE_ID / REF_ID-typed `NodesRef`s would need their respective Element
 * PAPIs (`__GetElementByUniqueId`, etc.) — TODO when needed.
 */
function resolveNodesRefHost(identifier: string): FiberElement | undefined {
  const pageElement = __GetPageElement();
  if (!pageElement) return undefined;
  return __QuerySelector(pageElement, identifier, {});
}

/**
 * Applies a patch of snapshot operations to the main thread.
 * This is the counterpart to the patch generation in the background thread.
 * Each operation in the patch is processed sequentially to update the DOM.
 */
export function snapshotPatchApply(snapshotPatch: SnapshotPatch): void {
  const length = snapshotPatch.length;
  for (let i = 0; i < length; ++i) {
    switch (snapshotPatch[i]) {
      case SnapshotOperation.CreateElement: {
        const type = snapshotPatch[++i] as string;
        const id = snapshotPatch[++i] as number;
        new SnapshotInstance(type, id);
        break;
      }
      case SnapshotOperation.InsertBefore: {
        const parentId = snapshotPatch[++i] as number;
        const childId = snapshotPatch[++i] as number;
        const beforeId = snapshotPatch[++i] as number | undefined;
        const __slotIndex = snapshotPatch[++i] as number;
        const parent = snapshotInstanceManager.values.get(parentId);
        const child = snapshotInstanceManager.values.get(childId);
        const existingNode = snapshotInstanceManager.values.get(beforeId!);
        if (!parent || !child) {
          sendCtxNotFoundEventToBackground(parent ? childId : parentId);
        } else {
          child.__slotIndex = __slotIndex;
          parent.insertBefore(child, existingNode);
        }
        break;
      }
      case SnapshotOperation.RemoveChild: {
        const parentId = snapshotPatch[++i] as number;
        const childId = snapshotPatch[++i] as number;
        const parent = snapshotInstanceManager.values.get(parentId);
        const child = snapshotInstanceManager.values.get(childId);
        if (!parent || !child) {
          sendCtxNotFoundEventToBackground(parent ? childId : parentId);
        } else {
          parent.removeChild(child);
        }
        break;
      }
      case SnapshotOperation.nodesRefInsertBefore: {
        const identifier = snapshotPatch[++i] as string;
        const childId = snapshotPatch[++i] as number;
        const beforeId = snapshotPatch[++i] as number | undefined;
        const child = snapshotInstanceManager.values.get(childId);
        if (!child) {
          sendCtxNotFoundEventToBackground(childId);
          break;
        }
        const host = resolveNodesRefHost(identifier);
        if (!host) break;
        if (!child.__elements) {
          child.ensureElements();
        }
        const childRoot = child.__element_root!;
        if (beforeId !== undefined) {
          const before = snapshotInstanceManager.values.get(beforeId);
          if (before?.__element_root) {
            __InsertElementBefore(host, childRoot, before.__element_root);
            break;
          }
        }
        __AppendElement(host, childRoot);
        break;
      }
      case SnapshotOperation.nodesRefRemoveChild: {
        const identifier = snapshotPatch[++i] as string;
        const childId = snapshotPatch[++i] as number;
        const child = snapshotInstanceManager.values.get(childId);
        if (!child) {
          sendCtxNotFoundEventToBackground(childId);
          break;
        }
        const childRoot = child.__element_root;
        if (!childRoot) break;
        const host = resolveNodesRefHost(identifier);
        if (host) {
          __RemoveElement(host, childRoot);
          traverseSnapshotInstance(child, v => {
            snapshotInstanceManager.values.delete(v.__id);
          });
        }
        break;
      }
      case SnapshotOperation.SetAttribute: {
        const id = snapshotPatch[++i] as number;
        const dynamicPartIndex = snapshotPatch[++i] as number;
        const value = snapshotPatch[++i];
        const si = snapshotInstanceManager.values.get(id);
        if (si) {
          si.setAttribute(dynamicPartIndex, value);
        } else {
          sendCtxNotFoundEventToBackground(id);
        }
        break;
      }
      case SnapshotOperation.SetAttributes: {
        const id = snapshotPatch[++i] as number;
        const values = snapshotPatch[++i];
        const si = snapshotInstanceManager.values.get(id);
        if (si) {
          si.setAttribute('values', values);
        } else {
          sendCtxNotFoundEventToBackground(id);
        }
        break;
      }
      case SnapshotOperation.DEV_ONLY_AddSnapshot: {
        if (__DEV__) {
          const uniqID = snapshotPatch[++i] as string;
          const snapshotCreator = snapshotPatch[++i] as string;

          // HMR-related
          // Update the evaluated snapshots from JS.
          snapshotCreatorMap[uniqID] = evaluate<(uniqId: string) => string>(snapshotCreator);
        }
        break;
      }
      case SnapshotOperation.DEV_ONLY_SetSnapshotEntryName: {
        if (__DEV__) {
          const uniqID = snapshotPatch[++i] as string;
          const entryName = snapshotPatch[++i] as string;

          // HMR-related
          // Update the evaluated snapshot entryName from JS.
          snapshotCreatorMap[uniqID] = evaluate<(uniqId: string) => string>(
            snapshotCreatorMap[uniqID]!.toString().replace(/globDynamicComponentEntry/g, JSON.stringify(entryName)),
          );
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

/* v8 ignore start */
/**
 * Evaluates a string as code with ReactLynx runtime injected.
 * Used for HMR (Hot Module Replacement) to update snapshot definitions.
 */
function evaluate<T>(code: string): T {
  if (__DEV__) {
    // We are using `eval` here to make the updated snapshot to access variables like `__webpack_require__`.
    // See: https://github.com/lynx-family/lynx-stack/issues/983.
    return eval(`(() => ${code})()`) as T;
  }
  throw new Error('unreachable: evaluate is not supported in production');
}
/* v8 ignore stop */
