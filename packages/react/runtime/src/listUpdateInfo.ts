// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { hydrate } from './hydrate.js';
import { componentAtIndexFactory, enqueueComponentFactory } from './list.js';
import type { PlatformInfo } from './snapshot/platformInfo.js';
import type { SnapshotInstance } from './snapshot.js';

export interface ListUpdateInfo {
  flush(): void;
  onInsertBefore(
    newNode: SnapshotInstance,
    existingNode?: SnapshotInstance,
  ): void;
  onRemoveChild(child: SnapshotInstance): void;
  onSetAttribute(child: SnapshotInstance, attr: PlatformInfo, oldAttr?: PlatformInfo): void;
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

interface InsertAction {
  position: number;
  type: string;
}

interface UpdateAction {
  from: number;
  to: number;
  type: string;
  flush: boolean;
}

interface ListOperations {
  insertAction: InsertAction[];
  removeAction: number[];
  updateAction: UpdateAction[];
}

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
    const [componentAtIndex, componentAtIndexes] = componentAtIndexFactory(this.list.childNodes, hydrate);
    __UpdateListCallbacks(
      listElement,
      componentAtIndex,
      enqueueComponentFactory(),
      componentAtIndexes,
    );
  }

  private oldChildNodes: SnapshotInstance[];
  // private oldChildNodesSet: Set<SnapshotInstance>;
  private removeChild = new Set<SnapshotInstance>();
  private insertBefore = new Map<SnapshotInstance, SnapshotInstance[]>(); // insert V before K
  private appendChild = [] as SnapshotInstance[];
  private platformInfoUpdate = new Map<SnapshotInstance, any>();

  onInsertBefore(newNode: SnapshotInstance, existingNode?: SnapshotInstance): void {
    if (newNode.parentNode) {
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

  onSetAttribute(child: SnapshotInstance, attr: PlatformInfo, oldAttr?: PlatformInfo): void {
    if (!oldAttr || attr['item-key'] === oldAttr['item-key']) {
      this.platformInfoUpdate.set(child, attr);
    } else {
      this.onInsertBefore(child, child.nextSibling ?? undefined);
    }
  }

  private __toAttribute(): ListOperations {
    const { removeChild, insertBefore, appendChild, platformInfoUpdate } = this;

    const removals: number[] = [];
    const insertions: InsertAction[] = [];
    const updates: UpdateAction[] = [];

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
        } as UpdateAction);
      }
      if (insertBefore.has(child)) {
        const children = insertBefore.get(child)!;
        children.forEach(c => {
          insertions.push({
            position: j,
            type: c.type,
            ...c.__listItemPlatformInfo,
          } as InsertAction);
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
      } as InsertAction);
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

      // `__GetAttributeByName` is available since Lynx 2.14
      if (__GetAttributeByName(listElement, 'custom-list-name') === 'list-container') {
        // `updateAction` must be full (not incremental) when Lynx version <= 2.18 and
        // when `custom-list-name` is `list-container` (available when Lynx version >= 2.14) is true,
        updates.length = 0;
        this.list.childNodes.forEach((child, index) => {
          updates.push({
            ...child.__listItemPlatformInfo,
            from: index,
            to: index,
            // no flush
            flush: false,
            type: child.type,
          } as UpdateAction);
        });
      }
    }

    return {
      insertAction: insertions,
      removeAction: removals,
      updateAction: updates,
    };
  }

  toJSON(): [ListOperations] {
    // if (this.__pendingAttributes) {
    //   return [...this.__pendingAttributes, this.__toAttribute()];
    // } else {
    //   return [this.__toAttribute()];
    // }

    return [this.__toAttribute()] as const;
  }
}
