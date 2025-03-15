// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { hydrate } from './hydrate.js';
import { commitMainThreadPatchUpdate } from './lifecycle/patch/updateMainThread.js';
import type { SnapshotInstance } from './snapshot.js';

export interface ListUpdateInfo {
  flush(): void;
  onInsertBefore(
    newNode: SnapshotInstance,
    existingNode?: SnapshotInstance,
  ): void;
  onRemoveChild(child: SnapshotInstance): void;
  onSetAttribute(child: SnapshotInstance, attr: any, oldAttr: any): void;
}

interface UpdateAction {
  insertAction: {
    position: number;
    type: string;
  }[];
  removeAction: number[];
  // TODO: type `updateAction`
  updateAction: any[];
}

// class ListUpdateInfoDiffing implements ListUpdateInfo {
//   private oldChildNodes: SnapshotInstance[];
//   constructor(private list: SnapshotInstance) {
//     this.oldChildNodes = list.childNodes;
//   }
//   flush(): void {
//     Object.defineProperty(SnapshotInstance.prototype, "key", {
//       get: function () {
//         return this.values[0]["item-key"];
//       },
//     });

//   }
//   onInsertBefore(newNode: SnapshotInstance, existingNode?: SnapshotInstance | undefined): void {}
//   onRemoveChild(child: SnapshotInstance): void {}
//   onSetAttribute(child: SnapshotInstance, attr: any): void {
//     throw new Error("Method not implemented.");
//   }
// }

export class ListUpdateInfoRecording implements ListUpdateInfo {
  constructor(private list: SnapshotInstance) {
    this.oldChildNodes = list.childNodes;
    // this.oldChildNodesSet = new Set(this.oldChildNodes);
  }

  // private __commitAndReset() {
  //   (this.__pendingAttributes ??= []).push(this.__toAttribute());
  //   this.oldChildNodes = this.list.childNodes;
  //   this.oldChildNodesSet = new Set(this.oldChildNodes);
  //   this.removeChild1.clear();
  //   this.removeChild2.clear();
  //   this.insertBefore.clear();
  //   this.appendChild.length = 0;
  //   this.platformInfoUpdate.clear();
  // }

  flush(): void {
    const elementIndex = this.list.__snapshot_def.slot[0]![1];
    const listElement = this.list.__elements![elementIndex]!;
    // this.__pendingAttributes?.forEach(pendingAttribute => {
    //   __SetAttribute(listElement, "update-list-info", pendingAttribute);
    //   __FlushElementTree(listElement);
    // });
    __SetAttribute(listElement, 'update-list-info', this.__toAttribute());
    __UpdateListCallbacks(
      listElement,
      componentAtIndexFactory(this.list.childNodes),
      enqueueComponentFactory(),
    );
  }

  private oldChildNodes: SnapshotInstance[];
  // private oldChildNodesSet: Set<SnapshotInstance>;
  private removeChild = new Set<SnapshotInstance>();
  private insertBefore = new Map<SnapshotInstance, SnapshotInstance[]>(); // insert V before K
  private appendChild = [] as SnapshotInstance[];
  private platformInfoUpdate = new Map<SnapshotInstance, any>();

  onInsertBefore(newNode: SnapshotInstance, existingNode?: SnapshotInstance): void {
    // @ts-ignore
    if (newNode.__parent) {
      // if (!this.oldChildNodesSet.has(newNode)) {
      //   this.__commitAndReset();
      // }
      this.removeChild.add(newNode);
    }
    if (existingNode) {
      // if (!this.oldChildNodesSet.has(existingNode)) {
      //   this.__commitAndReset();
      // }
      const newChildren = this.insertBefore.get(existingNode) ?? [];
      newChildren.push(newNode);
      this.insertBefore.set(existingNode, newChildren);
    } else {
      this.appendChild.push(newNode);
    }
  }

  onRemoveChild(child: SnapshotInstance): void {
    // if (!this.oldChildNodesSet.has(child)) {
    //   this.__commitAndReset();
    // }
    this.removeChild.add(child);
  }

  onSetAttribute(child: SnapshotInstance, attr: any, _oldAttr: any): void {
    this.platformInfoUpdate.set(child, attr);
  }

  private __toAttribute(): UpdateAction {
    const { removeChild, insertBefore, appendChild, platformInfoUpdate } = this;

    const removals: number[] = [];
    const insertions: { position: number; type: string }[] = [];
    const updates: any[] = [];

    let j = 0;
    for (let i = 0; i < this.oldChildNodes.length; i++, j++) {
      const child = this.oldChildNodes[i]!;
      if (platformInfoUpdate.has(child)) {
        updates.push({
          ...platformInfoUpdate.get(child),
          from: +j,
          to: +j,
          // no flush
          flush: false,
          type: child.type,
        });
      }
      if (insertBefore.has(child)) {
        const children = insertBefore.get(child)!;
        children.forEach(c => {
          insertions.push({
            position: j,
            type: c.type,
            ...c.__listItemPlatformInfo,
          });
          j++;
        });
      }
      if (removeChild.has(child)) {
        removals.push(i);
        removeChild.delete(child);
        j--;
      }
    }
    for (let i = 0; i < appendChild.length; i++) {
      const child = appendChild[i]!;
      insertions.push({
        position: j + i,
        type: child.type,
        ...child.__listItemPlatformInfo,
      });
    }

    insertions.sort((a, b) => a.position - b.position);
    removals.sort((a, b) => a - b);

    if (
      SystemInfo.lynxSdkVersion === '2.14'
      || SystemInfo.lynxSdkVersion === '2.15'
      || SystemInfo.lynxSdkVersion === '2.16'
      || SystemInfo.lynxSdkVersion === '2.17'
      || SystemInfo.lynxSdkVersion === '2.18'
    ) {
      const elementIndex = this.list.__snapshot_def.slot[0]![1];
      const listElement = this.list.__elements![elementIndex]!;

      // `__GetAttributeByName` is avaiable since Lynx 2.14
      if (__GetAttributeByName(listElement, 'custom-list-name') === 'list-container') {
        // `updateAction` must be full (not incremental) when Lynx version <= 2.18 and
        // when `custom-list-name` is `list-container` (avaiable when Lynx version >= 2.14) is true,
        updates.length = 0;
        this.list.childNodes.forEach((child, index) => {
          updates.push({
            ...child.__listItemPlatformInfo,
            from: index,
            to: index,
            // no flush
            flush: false,
            type: child.type,
          });
        });
      }
    }

    return {
      insertAction: insertions,
      removeAction: removals,
      updateAction: updates,
    };
  }

  toJSON(): [UpdateAction] {
    // if (this.__pendingAttributes) {
    //   return [...this.__pendingAttributes, this.__toAttribute()];
    // } else {
    //   return [this.__toAttribute()];
    // }

    return [this.__toAttribute()] as const;
  }
}

export const __pendingListUpdates = {
  values: {} as Record<number, ListUpdateInfo>,
  clear(): void {
    this.values = {};
  },
  flush(): void {
    Object.values(this.values).forEach(update => {
      update.flush();
    });
    this.clear();
  },
};

export const gSignMap: Record<number, Map<number, SnapshotInstance>> = {};
export const gRecycleMap: Record<number, Map<string, Map<number, SnapshotInstance>>> = {};

export function clearListGlobal(): void {
  for (const key in gSignMap) {
    delete gSignMap[key];
  }
  for (const key in gRecycleMap) {
    delete gRecycleMap[key];
  }
}

export function componentAtIndexFactory(ctx: SnapshotInstance[]): ComponentAtIndexCallback {
  const componentAtIndex = (
    list: FiberElement,
    listID: number,
    cellIndex: number,
    operationID: number,
    enableReuseNotification: boolean,
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
        __FlushElementTree(root, { triggerLayout: true, operationID, elementID: sign, listID });
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
      hydrate(oldCtx, childCtx);
      oldCtx.unRenderElements();
      const root = childCtx.__element_root!;
      if (enableReuseNotification) {
        __FlushElementTree(root, {
          triggerLayout: true,
          operationID,
          elementID: sign,
          listID,
          listReuseNotification: {
            listElement: list,
            itemKey: platformInfo['item-key'],
          },
        });
      } else {
        __FlushElementTree(root, {
          triggerLayout: true,
          operationID,
          elementID: sign,
          listID,
        });
      }
      signMap.set(sign, childCtx);
      commitMainThreadPatchUpdate(undefined);
      return sign;
    }

    childCtx.ensureElements();
    const root = childCtx.__element_root!;
    __AppendElement(list, root);
    const sign = __GetElementUniqueID(root);
    __FlushElementTree(root, {
      triggerLayout: true,
      operationID,
      elementID: sign,
      listID,
    });
    signMap.set(sign, childCtx);
    commitMainThreadPatchUpdate(undefined);
    return sign;
  };
  return componentAtIndex;
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

export function snapshotCreateList(
  pageId: number,
  _ctx: SnapshotInstance,
  _expIndex: number,
): FiberElement {
  const signMap = new Map<number, SnapshotInstance>();
  const recycleMap = new Map<string, Map<number, SnapshotInstance>>();
  const list = __CreateList(
    pageId,
    componentAtIndexFactory([]),
    enqueueComponentFactory(),
    {},
  );
  const listID = __GetElementUniqueID(list);
  gSignMap[listID] = signMap;
  gRecycleMap[listID] = recycleMap;
  return list;
}

export function snapshotDestroyList(si: SnapshotInstance): void {
  const [, elementIndex] = si.__snapshot_def.slot[0]!;
  const list = si.__elements![elementIndex]!;
  const listID = __GetElementUniqueID(list);
  delete gSignMap[listID];
  delete gRecycleMap[listID];
}
