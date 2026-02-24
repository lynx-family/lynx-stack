// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { LifecycleConstant } from './lifecycleConstant.js';
import { applyRefQueue } from './snapshot/workletRef.js';
import type { SnapshotInstance } from './snapshot.js';
import { maybePromise } from './utils.js';

export const gSignMap: Record<number, Map<number, SnapshotInstance>> = {};
export const gRecycleMap: Record<number, Map<string, Map<number, SnapshotInstance>>> = {};
const gParentWeakMap: WeakMap<SnapshotInstance, unknown> = new WeakMap();
const resolvedPromise = /* @__PURE__ */ Promise.resolve();

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

    /* v8 ignore start */
    if (!signMap || !recycleMap) {
      // Theoretically unreachable since snapshotDestroyList clears componentAtIndex with a noop function.
      // Kept as a safeguard in case the callback is somehow invoked after list removal.
      throw new Error('componentAtIndex called on removed list');
    }
    /* v8 ignore end */

    const platformInfo = childCtx.__listItemPlatformInfo ?? {};

    // The lifecycle of this `__extraProps.isReady`:
    //   0 -> Promise<number> -> 1
    // 0: The initial state, the list-item is not ready yet, we will send a event to background
    //    when `componentAtIndex` is called on it
    // Promise<number>: A promise that will be resolved when the list-item is ready
    // 1: The list-item is ready, we can use it to render the list
    if (childCtx.__extraProps?.['isReady'] === 0) {
      if (
        typeof __GetAttributeByName === 'function'
        && __GetAttributeByName(list, 'custom-list-name') === 'list-container'
      ) {
        // we are in supported env
        // do not throw
      } else {
        throw new Error(
          'Unsupported: `<list-item/>` with `defer={true}` must be used with `<list custom-list-name="list-container"/>`',
        );
      }

      __OnLifecycleEvent([LifecycleConstant.publishEvent, {
        handlerName: `${childCtx.__id}:__extraProps:onComponentAtIndex`,
        data: {},
      }]);

      let p: Promise<number>;
      return (p = new Promise<number>((resolve) => {
        Object.defineProperty(childCtx.__extraProps, 'isReady', {
          set(isReady) {
            if (isReady === 1) {
              delete childCtx.__extraProps!['isReady'];
              childCtx.__extraProps!['isReady'] = 1;

              void resolvedPromise.then(() => {
                // the cellIndex may be changed already, but the `childCtx` is the same
                resolve(componentAtChildCtx(list, listID, childCtx, operationID, enableReuseNotification));
              });
            }
          },
          get() {
            return p;
          },
        });
      }));
    } else if (maybePromise<number>(childCtx.__extraProps?.['isReady'])) {
      throw new Error('componentAtIndex was called on a pending deferred list item');
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
      } else if (oldCtx.__extraProps?.['isReady'] === 1) {
        __OnLifecycleEvent([LifecycleConstant.publishEvent, {
          handlerName: `${oldCtx.__id}:__extraProps:onRecycleComponent`,
          data: {},
        }]);
      }
      const root = childCtx.__element_root!;
      applyRefQueue();
      // In the defer `list-item` scenario, `componentAtIndex` occurs with delay.
      // Within `componentAtIndex`, nodes that quickly appear and disappear due to re-layout will be enqueued again,
      // causing the mapping relationship between sign and SnapshotInstance to become corrupted.
      // This results in a SnapshotInstance without `__elements` being enqueued.
      signMap.set(sign, childCtx);
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
      return sign;
    }

    childCtx.ensureElements();
    const root = childCtx.__element_root!;
    __AppendElement(list, root);
    const sign = __GetElementUniqueID(root);
    applyRefQueue();
    signMap.set(sign, childCtx);
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
    const r = componentAtChildCtx(list, listID, childCtx, operationID, enableReuseNotification);

    /* v8 ignore start */
    if (process.env['NODE_ENV'] === 'test') {
      return r;
    } else {
      return typeof r === 'number' ? r : undefined;
    }
    /* v8 ignore end */
  }

  function componentAtIndexes(
    list: FiberElement,
    listID: number,
    cellIndexes: number[],
    operationIDs: number[],
    enableReuseNotification: boolean,
    asyncFlush: boolean,
  ) {
    let hasUnready = false;
    const p: Array<Promise<number> | number> = [];

    cellIndexes.forEach((cellIndex, index) => {
      const operationID = operationIDs[index]!;
      const childCtx = ctx[cellIndex];
      if (!childCtx) {
        throw new Error('childCtx not found');
      }

      const u = componentAtChildCtx(list, listID, childCtx, operationID, enableReuseNotification, true, asyncFlush);
      if (typeof u === 'number') {
        // ready
      } else {
        hasUnready = true;
      }
      p.push(u);
    });

    // We need __FlushElementTree twice:
    // 1. The first time is sync, we flush the items that are ready, with unready items' uiSign as -1.
    // 2. The second time is async, with all the uiSigns.
    // NOTE: The `operationIDs` passed to __FlushElementTree must be the one passed in,
    // not the one generated by any code here, to workaround a bug of Lynx Engine.
    // So we CANNOT split the `operationIDs` into two parts: one for ready items, one for unready items.
    if (hasUnready) {
      // eslint-disable-next-line @typescript-eslint/await-thenable
      void Promise.all(p).then((uiSigns) => {
        __FlushElementTree(list, {
          triggerLayout: true,
          operationIDs,
          elementIDs: uiSigns,
          listID,
        });
      });
    }
    __FlushElementTree(list, {
      triggerLayout: true,
      operationIDs,
      elementIDs: cellIndexes.map((_, index) => typeof p[index] === 'number' ? p[index] : -1),
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
