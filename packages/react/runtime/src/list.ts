// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { applyRefQueue } from './snapshot/workletRef.js';
import type { SnapshotInstance } from './snapshot.js';

export const gSignMap: Record<number, Map<number, SnapshotInstance>> = {};
export const gRecycleMap: Record<number, Map<string, Map<number, SnapshotInstance>>> = {};
const gParentWeakMap: WeakMap<SnapshotInstance, unknown> = new WeakMap();

export function clearListGlobal(): void {
  for (const key in gSignMap) {
    delete gSignMap[key];
  }
  for (const key in gRecycleMap) {
    delete gRecycleMap[key];
  }
}

export function componentAtIndexFactory(
  ctx: SnapshotInstance[],
  hydrateFunction: (before: SnapshotInstance, after: SnapshotInstance) => void,
): [ComponentAtIndexCallback, ComponentAtIndexesCallback] {
  // A hack workaround to ensure childCtx has no direct reference through `__parent` to list,
  // to avoid memory leak.
  // TODO(hzy): make `__parent` a WeakRef or `#__parent` in the future.
  ctx.forEach((childCtx) => {
    if (gParentWeakMap.has(childCtx)) {
      // do it only once
    } else {
      gParentWeakMap.set(childCtx, childCtx.parentNode!);
      Object.defineProperty(childCtx, '__parent', {
        get: () => gParentWeakMap.get(childCtx)!,
        set: (value: unknown) => {
          gParentWeakMap.set(childCtx, value);
        },
      });
    }
  });

  const componentAtIndex = (
    list: FiberElement,
    listID: number,
    cellIndex: number,
    operationID: number,
    enableReuseNotification: boolean,
    enableBatchRender: boolean = false,
    asyncFlush: boolean = false,
  ) => {
    const signMap = gSignMap[listID];
    const recycleMap = gRecycleMap[listID];
    if (!signMap || !recycleMap) {
      throw new Error('componentAtIndex called on removed list');
    }

    const childCtx = ctx[cellIndex];
    if (!childCtx) {
      throw new Error('childCtx not found');
    }

    const platformInfo = childCtx.__listItemPlatformInfo || {};

    const uniqID = childCtx.type + (platformInfo['reuse-identifier'] ?? '');
    const recycleSignMap = recycleMap.get(uniqID);

    if (childCtx.__elements) {
      /**
       * If this situation is encountered, there might be two cases:
       * 1. Reusing with itself
       *    In this case, enqueueComponent will be triggered first, followed by componentAtIndex.
       * 2. Moving
       *    In this case, the trigger order is uncertain; componentAtIndex might be triggered first, or enqueueComponent might be triggered first.
       *
       * When enqueueComponent is triggered first, there must be an item in the reuse pool with the same sign as here, which can be returned directly.
       * When componentAtIndex is triggered first, a clone needs to be made first, then follow the logic for adding or reusing. The cloned item will enter the reuse pool in the subsequent enqueueComponent.
       */
      const root = childCtx.__elements[0]!;
      const sign = __GetElementUniqueID(root);

      if (recycleSignMap?.has(sign)) {
        signMap.set(sign, childCtx);
        recycleSignMap.delete(sign);
        if (!enableBatchRender) {
          __FlushElementTree(root, { triggerLayout: true, operationID, elementID: sign, listID });
        } else if (enableBatchRender && asyncFlush) {
          __FlushElementTree(root, { asyncFlush: true });
        }
        // enableBatchRender == true && asyncFlush == false
        // in this case, no need to invoke __FlushElementTree because in the end of componentAtIndexes(), the list will invoke __FlushElementTree.
        return sign;
      } else {
        const newCtx = childCtx.takeElements();
        signMap.set(sign, newCtx);
      }
    }

    if (recycleSignMap && recycleSignMap.size > 0) {
      const [first] = recycleSignMap;
      const [sign, oldCtx] = first!;
      recycleSignMap.delete(sign);
      hydrateFunction(oldCtx, childCtx);
      oldCtx.unRenderElements();
      if (!oldCtx.__id) {
        oldCtx.tearDown();
      }
      const root = childCtx.__element_root!;
      applyRefQueue();
      if (!enableBatchRender) {
        const flushOptions: FlushOptions = {
          triggerLayout: true,
          operationID,
          elementID: sign,
          listID,
        };
        if (enableReuseNotification) {
          flushOptions.listReuseNotification = {
            listElement: list,
            itemKey: platformInfo['item-key'],
          };
        }
        __FlushElementTree(root, flushOptions);
      } else if (enableBatchRender && asyncFlush) {
        const flushOptions: FlushOptions = {
          asyncFlush: true,
        };
        if (enableReuseNotification) {
          flushOptions.listReuseNotification = {
            listElement: list,
            itemKey: platformInfo['item-key'],
          };
        }
        __FlushElementTree(root, flushOptions);
      }
      signMap.set(sign, childCtx);
      return sign;
    }

    childCtx.ensureElements();
    const root = childCtx.__element_root!;
    __AppendElement(list, root);
    const sign = __GetElementUniqueID(root);
    applyRefQueue();
    if (!enableBatchRender) {
      __FlushElementTree(root, {
        triggerLayout: true,
        operationID,
        elementID: sign,
        listID,
      });
    } else if (enableBatchRender && asyncFlush) {
      __FlushElementTree(root, {
        asyncFlush: true,
      });
    }
    signMap.set(sign, childCtx);
    return sign;
  };

  const componentAtIndexes = (
    list: FiberElement,
    listID: number,
    cellIndexes: number[],
    operationIDs: number[],
    enableReuseNotification: boolean,
    asyncFlush: boolean,
  ) => {
    const uiSigns = cellIndexes.map((cellIndex, index) => {
      const operationID = operationIDs[index] ?? 0;
      return componentAtIndex(list, listID, cellIndex, operationID, enableReuseNotification, true, asyncFlush);
    });
    __FlushElementTree(list, {
      triggerLayout: true,
      operationIDs: operationIDs,
      elementIDs: uiSigns,
      listID,
    });
  };
  return [componentAtIndex, componentAtIndexes] as const;
}

export function enqueueComponentFactory(): EnqueueComponentCallback {
  const enqueueComponent = (_: FiberElement, listID: number, sign: number) => {
    const signMap = gSignMap[listID];
    const recycleMap = gRecycleMap[listID];
    if (!signMap || !recycleMap) {
      throw new Error('enqueueComponent called on removed list');
    }

    const childCtx = signMap.get(sign)!;
    if (!childCtx) {
      return;
    }

    const platformInfo = childCtx.__listItemPlatformInfo || {};

    const uniqID = childCtx.type + (platformInfo['reuse-identifier'] ?? '');
    if (!recycleMap.has(uniqID)) {
      recycleMap.set(uniqID, new Map());
    }
    recycleMap.get(uniqID)!.set(sign, childCtx);
  };
  return enqueueComponent;
}
