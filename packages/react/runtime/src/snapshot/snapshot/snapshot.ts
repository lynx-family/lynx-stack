// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Main thread snapshot implementation that runs in the main thread.
 *
 * This is the mirror of background's {@link BackgroundSnapshotInstance}:
 */

import type { Worklet, WorkletRefImpl } from '@lynx-js/react/worklet-runtime/bindings';

import { DEFAULT_CSS_ID, DEFAULT_ENTRY_NAME } from './constants.js';
import { snapshotManager } from './definition.js';
import type { Snapshot } from './definition.js';
import { DynamicPartType, __DynamicPartChildren_0 } from './dynamicPartType.js';
import { snapshotDestroyList } from './list.js';
import type { PlatformInfo } from './platformInfo.js';
import { unref } from './ref.js';
import type { SerializedSnapshotInstance } from './types.js';
import { traverseSnapshotInstance } from './utils.js';
import { isDirectOrDeepEqual } from '../../utils.js';
import { clearSnapshotVNodeSource } from '../debug/vnodeSource.js';
import { SnapshotOperation, __globalSnapshotPatch } from '../lifecycle/patch/snapshotPatch.js';
import { ListUpdateInfoRecording } from '../list/listUpdateInfo.js';
import { __pendingListUpdates } from '../list/pendingListUpdates.js';

export const snapshotInstanceManager: {
  nextId: number;
  values: Map<number, SnapshotInstance>;
  clear(): void;
} = {
  nextId: 0,
  values: /* @__PURE__ */ new Map<number, SnapshotInstance>(),
  clear() {
    // not resetting `nextId` to prevent id collision
    this.values.clear();
    if (__DEV__) {
      clearSnapshotVNodeSource();
    }
  },
};

export let snapshotCreatorMap: Record<string, (uniqId: string) => string> = {};

if (__DEV__ && __JS__) {
  snapshotCreatorMap = new Proxy(snapshotCreatorMap, {
    set(target, prop: string, value: (uniqId: string) => string) {
      if (
        // `__globalSnapshotPatch` does not exist before hydration,
        // so the snapshot of the first screen will not be sent to the main thread.
        __globalSnapshotPatch
        // `prop` will be `https://example.com/main.lynx.bundle:__snapshot_835da_eff1e_1` when loading a standalone lazy bundle after hydration.
        && !prop.includes(':')
      ) {
        __globalSnapshotPatch.push(
          SnapshotOperation.DEV_ONLY_AddSnapshot,
          prop,
          // We use `Function.prototype.toString` to serialize the `() => createSnapshot()` function for main thread.
          // This allows the updates to be applied to main thread.
          value.toString(),
        );
      }
      target[prop] = value;
      return true;
    },
  });
}

/**
 * The runtime instance of a {@link Snapshot} on the main thread that manages
 * the actual elements and handles updates to dynamic parts.
 *
 * This class is designed to be compatible with Preact's {@link ContainerNode}
 * interface for Preact's renderer to operate upon.
 */
export class SnapshotInstance {
  __id: number;
  __snapshot_def: Snapshot;
  __elements?: FiberElement[] | undefined;
  __element_root?: FiberElement | undefined;
  __values?: unknown[] | undefined;
  // current slot index for dynamic parts
  // only increment when inserting dynamic parts
  // when removing dynamic parts, the slot index will not change
  // cause there would be a wrapper to keep the slot index stable
  __current_slot_index = 0;
  __worklet_ref_set?: Set<WorkletRefImpl<any> | Worklet>;
  __listItemPlatformInfo?: PlatformInfo;
  __extraProps?: Record<string, unknown> | undefined;
  __slotIndex: number = 0;

  constructor(public type: string, id?: number) {
    // Suspense uses 'div'
    if (!snapshotManager.values.has(type) && type !== 'div') {
      if (snapshotCreatorMap[type]) {
        snapshotCreatorMap[type](type);
      } else {
        let message = 'Snapshot not found: ' + type;
        if (__DEV__) {
          message +=
            '. You can set environment variable `REACT_ALOG=true` and restart your dev server for troubleshooting.';
        }
        throw new Error(message);
      }
    }
    this.__snapshot_def = snapshotManager.values.get(type)!;

    id ??= snapshotInstanceManager.nextId -= 1;
    this.__id = id;
    snapshotInstanceManager.values.set(id, this);
  }

  ensureElements(): void {
    const { create, slot, isListHolder, cssId, entryName } = this.__snapshot_def;
    const elements = create!(this);
    this.__elements = elements;
    this.__element_root = elements[0];

    if (cssId === undefined) {
      // This means either:
      //   CSS Scope is removed(We only need to call `__SetCSSId` when there is `entryName`)
      //   Or an old bundle(`__SetCSSId` is called in `create`), we skip calling `__SetCSSId`
      if (entryName !== DEFAULT_ENTRY_NAME && entryName !== undefined) {
        __SetCSSId(this.__elements, DEFAULT_CSS_ID, entryName);
      }
    } else {
      // cssId !== undefined
      if (entryName !== DEFAULT_ENTRY_NAME && entryName !== undefined) {
        // For lazy bundle, we need add `entryName` to the third params
        __SetCSSId(this.__elements, cssId, entryName);
      } else {
        __SetCSSId(this.__elements, cssId);
      }
    }

    if (
      entryName !== DEFAULT_ENTRY_NAME && entryName !== undefined && this.parentNode
      && entryName !== this.parentNode.__snapshot_def.entryName
    ) {
      __SetAttribute(
        this.__element_root!,
        'bundle-url',
        this.__snapshot_def.entryName,
      );
    }

    __pendingListUpdates.runWithoutUpdates(() => {
      const values = this.__values;
      if (values) {
        this.__values = undefined;
        this.setAttribute('values', values);
      }
    });

    if (isListHolder) {
      // never recurse into list's children

      // In nested list scenarios, there are some `list` that are lazily created.
      // We need to `flush` them during `ensureElements`.
      // Also, `flush` is a safe operation since it checks if the `list` is in `__pendingListUpdates`.
      if (__pendingListUpdates.values && !__pendingListUpdates.values[this.__id] && this.__firstChild !== null) {
        let child: SnapshotInstance | null = this.__firstChild;
        while (child) {
          (__pendingListUpdates.values[this.__id] ??= new ListUpdateInfoRecording(this)).onInsertBefore(child);
          child = child.__nextSibling;
        }
      }
      __pendingListUpdates.flushWithId(this.__id);
    } else {
      let index = 0;
      let child = this.__firstChild;
      while (child) {
        child.ensureElements();

        const [type, elementIndex] = slot[this.__snapshot_def.isSlotV2 ? child.__slotIndex : index]!;
        switch (type) {
          case DynamicPartType.Slot: {
            __ReplaceElement(child.__element_root!, elements[elementIndex]!);
            elements[elementIndex] = child.__element_root!;
            index++;
            break;
          }
          /* v8 ignore start */
          case DynamicPartType.MultiChildren: {
            if (__GetTag(elements[elementIndex]!) === 'wrapper') {
              __ReplaceElement(child.__element_root!, elements[elementIndex]!);
            } else {
              __AppendElement(elements[elementIndex]!, child.__element_root!);
            }
            index++;
            break;
          }
          /* v8 ignore end */
          case DynamicPartType.Children:
          case DynamicPartType.ListChildren:
          case DynamicPartType.SlotV2:
          case DynamicPartType.ListSlotV2: {
            __AppendElement(elements[elementIndex]!, child.__element_root!);
            break;
          }
          default:
            throw new Error('Unexpected slot type: ' + type);
        }

        child = child.__nextSibling;
      }
    }
  }

  unRenderElements(): void {
    const { isListHolder } = this.__snapshot_def;
    this.__elements = undefined;
    this.__element_root = undefined;

    if (isListHolder) {
      // never recurse into list's children
    } else {
      let child = this.__firstChild;
      while (child) {
        child.unRenderElements();
        child = child.__nextSibling;
      }
    }
  }

  takeElements(): SnapshotInstance {
    const a = Object.create(SnapshotInstance.prototype) as SnapshotInstance;

    a.__id = this.__id;
    a.__snapshot_def = this.__snapshot_def;
    a.__values = this.__values;
    a.__slotIndex = this.__slotIndex;

    // all clear
    a.__parent = null;
    a.__firstChild = null;
    a.__lastChild = null;
    a.__nextSibling = null;
    a.__previousSibling = null;

    this.childNodes.map(c => c.takeElements()).forEach(node => a.__insertBefore(node));

    a.__elements = this.__elements;
    a.__element_root = this.__element_root;

    this.__elements = undefined;
    this.__element_root = undefined;
    return a;
  }

  tearDown(): void {
    traverseSnapshotInstance(this, v => {
      v.__parent = null;
      v.__previousSibling = null;
      v.__nextSibling = null;
    });
  }

  // onCreate?: () => void;
  // onAttach?: () => void;
  // onDetach?: () => void;
  // onRef?: () => void;
  // onUnref?: () => void;

  private __parent: SnapshotInstance | null = null;
  private __firstChild: SnapshotInstance | null = null;
  private __lastChild: SnapshotInstance | null = null;
  private __previousSibling: SnapshotInstance | null = null;
  private __nextSibling: SnapshotInstance | null = null;

  get parentNode(): SnapshotInstance | null {
    return this.__parent;
  }

  get nextSibling(): SnapshotInstance | null {
    return this.__nextSibling;
  }

  // get isConnected() {
  //   return !!this.__parent;
  // }

  contains(child: SnapshotInstance): boolean {
    return child.parentNode === this;
  }

  get childNodes(): SnapshotInstance[] {
    const nodes: SnapshotInstance[] = [];
    let node = this.__firstChild;
    while (node) {
      nodes.push(node);
      node = node.__nextSibling;
    }
    return nodes;
  }

  __insertBefore(node: SnapshotInstance, beforeNode?: SnapshotInstance): void {
    // If the node already has a parent, remove it from its current parent
    if (node.__parent) {
      node.__parent.__removeChild(node);
    }

    // If beforeNode is not provided, add the new node as the last child
    if (beforeNode) {
      // If beforeNode is provided, insert the new node before beforeNode
      if (beforeNode.__previousSibling) {
        beforeNode.__previousSibling.__nextSibling = node;
        node.__previousSibling = beforeNode.__previousSibling;
      } else {
        this.__firstChild = node;
        node.__previousSibling = null;
      }
      beforeNode.__previousSibling = node;
      node.__nextSibling = beforeNode;
      node.__parent = this;
    } else {
      if (this.__lastChild) {
        this.__lastChild.__nextSibling = node;
        node.__previousSibling = this.__lastChild;
      } else {
        this.__firstChild = node;
        node.__previousSibling = null;
      }
      this.__lastChild = node;
      node.__parent = this;
      node.__nextSibling = null;
    }
  }

  __removeChild(node: SnapshotInstance): void {
    if (node.__parent !== this) {
      throw new Error('The node to be removed is not a child of this node.');
    }

    if (node.__previousSibling) {
      node.__previousSibling.__nextSibling = node.__nextSibling;
    } else {
      this.__firstChild = node.__nextSibling;
    }

    if (node.__nextSibling) {
      node.__nextSibling.__previousSibling = node.__previousSibling;
    } else {
      this.__lastChild = node.__previousSibling;
    }

    node.__parent = null;
    node.__previousSibling = null;
    node.__nextSibling = null;
  }

  insertBefore(newNode: SnapshotInstance, existingNode?: SnapshotInstance): void {
    const __snapshot_def = this.__snapshot_def;
    if (__snapshot_def.isListHolder) {
      if (__pendingListUpdates.values) {
        (__pendingListUpdates.values[this.__id] ??= new ListUpdateInfoRecording(
          this,
        )).onInsertBefore(newNode, existingNode);
      }
      this.__insertBefore(newNode, existingNode);
      return;
    }

    const shouldRemove = newNode.__parent === this;
    this.__insertBefore(newNode, existingNode);
    const __elements = this.__elements;
    if (__elements) {
      if (!newNode.__elements) {
        newNode.ensureElements();
      }
    } else {
      return;
    }

    const count = __snapshot_def.slot.length;
    if (
      count === 1 || __snapshot_def.isSlotV2
    ) {
      const [, elementIndex] = __snapshot_def.slot[typeof newNode.__slotIndex === 'number' ? newNode.__slotIndex : 0]!;
      const parent = __elements[elementIndex]!;
      if (shouldRemove) {
        __RemoveElement(parent, newNode.__element_root!);
      }
      if (existingNode) {
        // SlotV2: each slot has its own wrapper. `existingNode` may live in a
        // different wrapper — `insertBefore(node, ref)` across wrappers throws,
        // so fall back to `append` (DOM auto-detaches the node from old parent).
        if (
          __snapshot_def.isSlotV2
          && newNode.__slotIndex !== existingNode.__slotIndex
        ) {
          __AppendElement(parent, newNode.__element_root!);
        } else {
          __InsertElementBefore(
            parent,
            newNode.__element_root!,
            existingNode.__element_root,
          );
        }
      } else {
        __AppendElement(parent, newNode.__element_root!);
      }
    } else if (count > 1) {
      const index = this.__current_slot_index++;
      const [s, elementIndex] = __snapshot_def.slot[index]!;

      if (s === DynamicPartType.Slot) {
        __ReplaceElement(newNode.__element_root!, __elements[elementIndex]!);
        __elements[elementIndex] = newNode.__element_root!;

        /* v8 ignore start */
      } else if (s === DynamicPartType.MultiChildren) {
        if (__GetTag(__elements[elementIndex]!) === 'wrapper') {
          __ReplaceElement(newNode.__element_root!, __elements[elementIndex]!);
        } else {
          __AppendElement(__elements[elementIndex]!, newNode.__element_root!);
        }
      }
      /* v8 ignore end */
    }
  }

  removeChild(child: SnapshotInstance): void {
    const __snapshot_def = this.__snapshot_def;
    if (__snapshot_def.isListHolder) {
      if (__pendingListUpdates.values) {
        (__pendingListUpdates.values[this.__id] ??= new ListUpdateInfoRecording(
          this,
        )).onRemoveChild(child);
      }

      this.__removeChild(child);
      traverseSnapshotInstance(child, v => {
        snapshotInstanceManager.values.delete(v.__id);
      });
      // mark this child as deleted
      child.__id = 0;
      return;
    }

    unref(child, true);
    if (this.__elements) {
      const [, elementIndex] = __snapshot_def.slot[typeof child.__slotIndex === 'number' ? child.__slotIndex : 0]!;
      __RemoveElement(this.__elements[elementIndex]!, child.__element_root!);
    }

    this.__removeChild(child);
    traverseSnapshotInstance(child, v => {
      if (v.__snapshot_def.isListHolder) {
        snapshotDestroyList(v);
      }

      v.__parent = null;
      v.__previousSibling = null;
      v.__nextSibling = null;
      delete v.__elements;
      delete v.__element_root;
      snapshotInstanceManager.values.delete(v.__id);
    });
  }

  // remove all children from start or this.__firstChild
  removeChildren(start: SnapshotInstance | null = this.__firstChild): void {
    let nodeToRemove = start;
    while (nodeToRemove) {
      const next = nodeToRemove.__nextSibling;
      this.removeChild(nodeToRemove);
      nodeToRemove = next;
    }
  }

  setAttribute(key: string | number, value: any): void {
    if (key === 'values') {
      const oldValues = this.__values;
      const values = value as unknown[];
      this.__values = values;
      if (oldValues) {
        for (let index = 0; index < values.length; index++) {
          this.callUpdateIfNotDirectOrDeepEqual(index, oldValues[index], values[index]);
        }
      } else {
        for (let index = 0; index < values.length; index++) {
          this.callUpdateIfNotDirectOrDeepEqual(index, undefined, values[index]);
        }
      }
      return;
    }

    if (typeof key === 'string') {
      // for more flexible usage, we allow setting non-indexed attributes
      (this.__extraProps ??= {})[key] = value;
      return;
    }

    this.__values ??= [];
    this.callUpdateIfNotDirectOrDeepEqual(key, this.__values[key], this.__values[key] = value);
  }

  toJSON(): Omit<SerializedSnapshotInstance, 'children'> & { children: SnapshotInstance[] | undefined } {
    const json: Omit<SerializedSnapshotInstance, 'children'> & { children: SnapshotInstance[] | undefined } = {
      id: this.__id,
      type: this.type,
      values: this.__values,
      extraProps: this.__extraProps,
      children: this.__firstChild ? this.childNodes : undefined,
    };
    // To save serialize time, we only serialize slotIndex if it is not 0
    if (this.__slotIndex > 0) {
      json.slotIndex = this.__slotIndex;
    }
    return json;
  }

  callUpdateIfNotDirectOrDeepEqual(index: number, oldValue: any, newValue: any): void {
    if (isDirectOrDeepEqual(oldValue, newValue)) {}
    else {
      this.__snapshot_def.update![index]!(this, index, oldValue);
    }
  }
}
