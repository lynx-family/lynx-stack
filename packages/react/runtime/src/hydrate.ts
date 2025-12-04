// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { profileEnd, profileStart } from './debug/utils.js';
import { componentAtIndexFactory, enqueueComponentFactory, gRecycleMap, gSignMap } from './list.js';
import { __pendingListUpdates } from './pendingListUpdates.js';
import { DynamicPartType } from './snapshot/dynamicPartType.js';
import type { PlatformInfo } from './snapshot/platformInfo.js';
import { unref } from './snapshot/ref.js';
import type { SnapshotInstance } from './snapshot.js';
import { isEmptyObject } from './utils.js';

const UNREACHABLE_ITEM_KEY_NOT_FOUND = 'UNREACHABLE_ITEM_KEY_NOT_FOUND';

export interface DiffResult<K> {
  $$diff: true;
  // insert No.j to new
  i: Record<number, K>;
  // remove No.i from old
  r: number[];
  // move No.i from old to No.j of new
  m: Record<number, number>;
}

export interface Typed {
  type: string;
  __listItemPlatformInfo?: PlatformInfo;
}

export function isEmptyDiffResult<K>(diffResult: DiffResult<K>): boolean {
  const hasChanged = !isEmptyObject(diffResult.i)
    || !isEmptyObject(diffResult.m) || diffResult.r.length > 0;
  return !hasChanged;
}

export function diffArrayLepus<A extends Typed, B extends Typed>(
  before: A[],
  after: B[],
  isSameType: (a: A, b: B) => boolean,
  onDiffChildren: (a: A, b: B, oldIndex: number, newIndex: number) => void,
  isListHasItemKey: boolean,
): DiffResult<B> {
  let lastPlacedIndex = 0;
  const result: DiffResult<B> = {
    $$diff: true,
    i: {},
    r: [],
    m: {},
  };
  const beforeMap: Record<string, Set<[A, number]>> = {};

  for (let i = 0; i < before.length; i++) {
    const node = before[i]!;
    const key = isListHasItemKey
      ? node.__listItemPlatformInfo?.['item-key'] ?? UNREACHABLE_ITEM_KEY_NOT_FOUND
      : node.type;
    (beforeMap[key] ??= new Set()).add([node, i]);
  }

  for (let i = 0; i < after.length; i++) {
    const afterNode = after[i]!;
    const key = isListHasItemKey
      ? afterNode.__listItemPlatformInfo?.['item-key'] ?? UNREACHABLE_ITEM_KEY_NOT_FOUND
      : afterNode.type;
    const beforeNodes = beforeMap[key];
    let beforeNode: [A, number];

    if (
      beforeNodes
      && beforeNodes.size > 0
      // @ts-expect-error TS does not know about iterator :)
      && (([beforeNode] = beforeNodes), beforeNode)
      && isSameType(beforeNode[0], afterNode)
    ) {
      // Reuse old node
      beforeNodes.delete(beforeNode);

      const oldIndex = beforeNode[1];
      onDiffChildren(beforeNode[0], afterNode, oldIndex, i);
      if (oldIndex < lastPlacedIndex) {
        result.m[oldIndex] = i;
        continue;
      } else {
        lastPlacedIndex = oldIndex;
      }
    } else {
      // Create new node
      result.i[i] = afterNode;
    }
  }
  // Delete
  for (const k in beforeMap) {
    for (const [, i] of beforeMap[k]!) {
      result.r.push(i);
    }
  }

  return result;
}

// export function diffIterableLepus<A extends Typed, B extends Typed>(
//   before: A[],
//   after: Iterable<B>,
//   isSameType: (a: A, b: B) => boolean,
//   onDiffChildren: (a: A, b: B) => void
// ): DiffResult<B> {
//   let returnResult = EMPTY_DIFF_RESULT as DiffResult<B>;
//   let lastPlacedIndex = 0;
//   const result: DiffResult<B> = {
//     $$diff: true,
//     i: {},
//     r: [],
//     m: {},
//   };
//   const beforeMap: Record<string, Set<[A, number]>> = {};

//   for (let i = 0; i < before.length; i++) {
//     let node = before[i];
//     (beforeMap[node.type] ??= new Set()).add([node, i]);
//   }

//   let i = 0;
//   for (const afterNode of after) {
//     const beforeNodes = beforeMap[afterNode.type];
//     let beforeNode: [A, number];

//     if (beforeNodes && (([beforeNode] = beforeNodes), beforeNode) && isSameType(beforeNode[0], afterNode)) {
//       // Reuse old node
//       beforeNodes.delete(beforeNode);

//       const oldIndex = beforeNode[1];
//       onDiffChildren(beforeNode[0], afterNode);
//       if (oldIndex < lastPlacedIndex) {
//         result.m[oldIndex] = i;
//         returnResult = result;
//         i++;
//         continue;
//       } else {
//         lastPlacedIndex = oldIndex;
//       }
//     } else {
//       // Create new node
//       result.i[i] = afterNode;
//       returnResult = result;
//     }
//     i++;
//   }
//   // delete
//   for (const k in beforeMap) {
//     for (const [, i] of beforeMap[k]) {
//       result.r.push(i);
//       returnResult = result;
//     }
//   }

//   return result;
// }

export function diffArrayAction<T, K>(
  before: T[],
  diffResult: DiffResult<K>,
  onInsert: (node: K, target: T | undefined) => T,
  onRemove: (node: T) => void,
  onMove: (node: T, target: T | undefined) => void,
): T[] {
  if (isEmptyDiffResult(diffResult)) {
    return before;
  }
  const deleteSet = new Set(diffResult.r);
  const { i: insertMap, m: placementMap } = diffResult;
  const moveTempMap = new Map<number, T>();
  let old: T | undefined;
  let k = 0;
  old = before[k];
  // let current: T | null | undefined = null;
  const result: T[] = [];
  let i = 0; // index of the old list
  let j = 0; // index of the new list
  let remain = Object.keys(insertMap).length;
  while (old || remain > 0) {
    let keep = false;
    if (old && deleteSet.has(j)) {
      // delete
      onRemove(old);
    } else if (old && placementMap[j] !== undefined) {
      // save node to re-use
      moveTempMap.set(placementMap[j]!, old);
      remain++;
    } else {
      // insert node
      let newNode = old;
      if (moveTempMap.has(i)) {
        // insert re-used node
        newNode = moveTempMap.get(i)!;
        keep = true;
        onMove(newNode, old);
        remain--;
      } else if (insertMap[i] !== undefined) {
        // insert new node
        newNode = onInsert(insertMap[i]!, old);
        keep = true;
        remain--;
      }

      result.push(newNode!);
      i++;
    }
    if (old && !keep) {
      old = before[++k];
      j++;
    }
  }

  return result;
}

export interface HydrationOptions {
  skipUnRef?: boolean;
  swap?: Record<number, number>;
}

export function hydrate(before: SnapshotInstance, after: SnapshotInstance, options?: HydrationOptions): void {
  after.__elements = before.__elements;
  after.__element_root = before.__element_root;

  if (!(options?.skipUnRef)) {
    unref(before, false);
  }

  let swap;
  if ((swap = options?.swap)) {
    swap[before.__id] = after.__id;
  }

  __pendingListUpdates.runWithoutUpdates(() => {
    after.__values?.forEach((value, index) => {
      const old = before.__values![index];
      if (value !== old) {
        after.__values![index] = old;
        after.setAttribute(index, value);
      }
    });
  });

  const { slot } = after.__snapshot_def;

  if (!slot) {
    return;
  }

  const beforeChildNodes = before.childNodes;
  const afterChildNodes = after.childNodes;

  slot.forEach(([type, elementIndex], index) => {
    switch (type) {
      case DynamicPartType.Slot:
      case DynamicPartType.MultiChildren: {
        // TODO: the following null assertions are not 100% safe
        const v1 = beforeChildNodes[index]!;
        const v2 = afterChildNodes[index]!;
        hydrate(v1, v2, options);
        break;
      }
      case DynamicPartType.Children: {
        const diffResult = diffArrayLepus(
          beforeChildNodes,
          afterChildNodes,
          (a, b) => a.type === b.type,
          (a, b) => {
            hydrate(a, b, options);
          },
          false,
        );
        diffArrayAction(
          beforeChildNodes,
          diffResult,
          (node, target) => {
            node.ensureElements();
            __InsertElementBefore(
              before.__elements![elementIndex]!,
              node.__element_root!,
              target?.__element_root,
            );
            return node;
          },
          node => {
            __RemoveElement(
              before.__elements![elementIndex]!,
              node.__element_root!,
            );
          },
          (node, target) => {
            __RemoveElement(
              before.__elements![elementIndex]!,
              node.__element_root!,
            );
            __InsertElementBefore(
              before.__elements![elementIndex]!,
              node.__element_root!,
              target?.__element_root,
            );
          },
        );
        break;
      }
      case DynamicPartType.ListChildren: {
        const removals: number[] = [];
        const insertions: number[] = [];
        const updateAction: any[] = [];

        const listID = __GetElementUniqueID(before.__elements![elementIndex]!);
        const signMap = gSignMap[listID]!;
        const recycleMap = gRecycleMap[listID]!;

        const diffResult = diffArrayLepus(
          beforeChildNodes,
          afterChildNodes,
          (a, b) => a.type === b.type,
          (a, b, _oldIndex, newIndex) => {
            if (
              JSON.stringify(a.__listItemPlatformInfo)
                !== JSON.stringify(b.__listItemPlatformInfo)
            ) {
              updateAction.push({
                ...b.__listItemPlatformInfo,
                from: newIndex,
                to: newIndex,
                // no flush
                flush: false,
                type: b.type,
              });
            }

            if (a.__elements) {
              // transfer a's elements to b
              hydrate(a, b, options);

              // if a list-item has `elements`, it may be:
              //   - `enqueueComponent` already called on it: so we need to update the `signMap` and the `recycleMap`
              //   - `enqueueComponent` not called on it: update the `signMap`
              const listItemID = __GetElementUniqueID(a.__element_root!);
              if (signMap.has(listItemID)) {
                signMap.set(listItemID, b);
              }
              if (recycleMap.has(a.type)) {
                const recycleSignMap = recycleMap.get(a.type)!;
                // Should only update `list-item` in the recycling pool
                // Because if an on-screen `list-item` is added to the recycling pool,
                // it could cause a blank screen when reused next time, as it may still be visible.
                if (recycleSignMap.has(listItemID)) {
                  recycleSignMap.set(listItemID, b);
                }
              }
            }
          },
          true,
        );

        for (const i of diffResult.r) {
          removals.push(i);
        }
        for (const i in diffResult.i) {
          insertions.push(Number(i));
        }
        for (const i in diffResult.m) {
          removals.push(Number(i));
          insertions.push(diffResult.m[i]!);
        }
        insertions.sort((a, b) => a - b);
        removals.sort((a, b) => a - b);

        const info = {
          insertAction: insertions.map((it) => ({
            position: it,
            type: afterChildNodes[it]!.type,
            ...afterChildNodes[it]!.__listItemPlatformInfo,
          })),
          removeAction: removals,
          updateAction,
        };

        if (__PROFILE__) {
          profileStart('ReactLynx::listHydrate::updateListInfo', {
            args: {
              'list id': String(listID),
              'update list info': JSON.stringify(info),
            },
          });
        }

        const listElement = before.__elements![elementIndex]!;
        __SetAttribute(listElement, 'update-list-info', info);
        const [componentAtIndex, componentAtIndexes] = componentAtIndexFactory(afterChildNodes, hydrate);
        __UpdateListCallbacks(
          listElement,
          componentAtIndex,
          enqueueComponentFactory(),
          componentAtIndexes,
        );

        // The `before` & `after` target to the same list element, so we need to
        // avoid the newly created list's (behind snapshot instance `after`) "update-list-info" being recorded.
        __pendingListUpdates.clear(after.__id);

        if (__PROFILE__) {
          profileEnd();
        }
      }
    }
  });
}
