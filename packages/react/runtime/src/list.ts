// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { applyRefQueue } from './snapshot/workletRef.js';
import type { SnapshotInstance } from './snapshot.js';
import { LifecycleConstant } from './lifecycleConstant.js';

export const gSignMap: Record<number, Map<number, SnapshotInstance>> = {};
export const gRecycleMap: Record<number, Map<string, Map<number, SnapshotInstance>>> = {};
const gParentWeakMap: WeakMap<SnapshotInstance, unknown> = new WeakMap();

const { gReadyCallbacks, saveReadyCallback } = /* @__PURE__ */ (function() {
  const gReadyCallbacks: Record<number, Map<number, () => void>> = {};

  function saveReadyCallback(listID: number, childCtxId: number, cb: () => void): void {
    gReadyCallbacks[listID] ??= new Map();
    gReadyCallbacks[listID]!.set(childCtxId, cb);
  }

  // @ts-expect-error `rLynxOnListItemReady` is a global function
  globalThis.rLynxOnListItemReady = (data: any) => {
    const { listID, childCtxId } = data;
    const cb = gReadyCallbacks[listID]?.get(childCtxId);
    if (cb) {
      gReadyCallbacks[listID]?.delete(childCtxId);
      cb();
    }
  };

  return { gReadyCallbacks, saveReadyCallback };
})();

export { gReadyCallbacks };

export function clearListGlobal(): void {
  for (const key in gSignMap) {
    delete gSignMap[key];
  }
  for (const key in gRecycleMap) {
    delete gRecycleMap[key];
  }
  for (const key in gReadyCallbacks) {
    delete gReadyCallbacks[key];
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

  const componentAtChildCtx = (
    list: FiberElement,
    listID: number,
    childCtx: SnapshotInstance,
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

    const platformInfo = childCtx.__listItemPlatformInfo ?? {};

    if (
      childCtx.__values?.[0]['data-isReady'] === false
    ) {
      __OnLifecycleEvent([LifecycleConstant.publishEvent, {
        handlerName: `${childCtx.__id}:0:bindComponentAtIndex`,
        data: {
          listID,
          childCtxId: childCtx.__id,
        },
      }]);

      return new Promise<number>((resolve) => {
        saveReadyCallback(listID, childCtx.__id, () => {
          // the cellIndex may be changed already, but the `childCtx` is the same
          resolve(componentAtChildCtx(list, listID, childCtx, operationID, enableReuseNotification));
        });
      });
    }

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
      } else if (
        oldCtx.__values?.[0]['data-isReady'] === true
      ) {
        __OnLifecycleEvent([LifecycleConstant.publishEvent, {
          handlerName: `${oldCtx.__id}:0:bindEnqueueComponent`,
        }]);
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
            itemKey: platformInfo['item-key']!,
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
            itemKey: platformInfo['item-key']!,
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

  function componentAtIndex(
    list: FiberElement,
    listID: number,
    cellIndex: number,
    operationID: number,
    enableReuseNotification: boolean,
  ) {
    const childCtx = ctx[cellIndex];
    if (!childCtx) {
      throw new Error('childCtx not found');
    }
    return componentAtChildCtx(list, listID, childCtx, operationID, enableReuseNotification);
  }

  function componentAtIndexes(
    list: FiberElement,
    listID: number,
    cellIndexes: number[],
    operationIDs: number[],
    enableReuseNotification: boolean,
    asyncFlush: boolean,
  ) {
    const readyOperationIDs: number[] = [];
    const readyUiSigns: number[] = [];
    const unreadyOperationIDs: number[] = [];
    const unreadyPromises: Promise<number>[] = [];

    cellIndexes.forEach((cellIndex, index) => {
      const operationID = operationIDs[index] ?? 0;
      const childCtx = ctx[cellIndex];
      if (!childCtx) {
        throw new Error('childCtx not found');
      }

      const u = componentAtChildCtx(list, listID, childCtx, operationID, enableReuseNotification, true, asyncFlush);
      if (typeof u === 'number') {
        readyOperationIDs.push(operationID);
        readyUiSigns.push(u);
      } else {
        unreadyOperationIDs.push(operationID);
        unreadyPromises.push(u);
      }
    });

    if (unreadyPromises.length > 0) {
      Promise.all(unreadyPromises).then((uiSigns) => {
        __FlushElementTree(list, {
          triggerLayout: true,
          operationIDs: unreadyOperationIDs,
          elementIDs: uiSigns,
          listID,
        });
      });
    }

    __FlushElementTree(list, {
      triggerLayout: true,
      operationIDs: readyOperationIDs,
      elementIDs: readyUiSigns,
      listID,
    });
  }
  return [componentAtIndex, componentAtIndexes] as const;
}

export function enqueueComponentFactory(): EnqueueComponentCallback {
  // eslint-disable-next-line unicorn/consistent-function-scoping
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

    const platformInfo = childCtx.__listItemPlatformInfo ?? {};

    const uniqID = childCtx.type + (platformInfo['reuse-identifier'] ?? '');
    if (!recycleMap.has(uniqID)) {
      recycleMap.set(uniqID, new Map());
    }
    recycleMap.get(uniqID)!.set(sign, childCtx);
  };
  return enqueueComponent;
}
