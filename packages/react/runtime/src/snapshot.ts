// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Core snapshot system that implements a compiler-hinted virtual DOM.
 *
 * Key components:
 * 1. {@link Snapshot}: Template definition generated at compile time
 * 2. {@link SnapshotInstance}: Runtime instance in the main thread
 * 3. {@link BackgroundSnapshotInstance}: Runtime instance in the background thread
 *
 * The system uses static analysis to identify dynamic parts and generate
 * optimized update instructions, avoiding full virtual DOM diffing.
 */

import { render } from 'preact';
import type { Attributes, ContainerNode, VNode } from 'preact';
import { cloneElement, unmountComponentAtNode } from 'preact/compat';
import { jsx as createVNode } from 'preact/jsx-runtime';

import type { Worklet, WorkletRefImpl } from '@lynx-js/react/worklet-runtime/bindings';

import type { BackgroundSnapshotInstance } from './backgroundSnapshot.js';
// import { printSnapshotInstance } from './debug/printSnapshot.js';
import { SnapshotOperation, __globalSnapshotPatch } from './lifecycle/patch/snapshotPatch.js';
import { ListUpdateInfoRecording } from './listUpdateInfo.js';
import { mtcComponentTypes } from './mtc/mtcComponentTypes.js';
import { mtcComponentVNodes } from './mtc/mtcComponentVNodes.js';
import { transformMTCProps } from './mtc/props.js';
import { __pendingListUpdates } from './pendingListUpdates.js';
import { DynamicPartType } from './snapshot/dynamicPartType.js';
import { snapshotDestroyList } from './snapshot/list.js';
import type { PlatformInfo } from './snapshot/platformInfo.js';
import { unref } from './snapshot/ref.js';
import { isDirectOrDeepEqual } from './utils.js';

/**
 * A snapshot definition that contains all the information needed to create and update elements
 * This is generated at compile time through static analysis of the JSX
 */
export interface Snapshot {
  create: null | ((ctx: SnapshotInstance) => FiberElement[]);
  update: null | ((ctx: SnapshotInstance, index: number, oldValue: any) => void)[];
  slot: [DynamicPartType, number][];

  isListHolder?: boolean;
  cssId?: number | undefined;
  entryName?: string | undefined;
  refAndSpreadIndexes?: number[] | null;
}

export let __page: FiberElement;
export let __pageId = 0;

export function setupPage(page: FiberElement): void {
  __page = page;
  __pageId = __GetElementUniqueID(page);
}

export function clearPage(): void {
  __page = undefined as unknown as FiberElement;
  __pageId = 0;
}

export const __DynamicPartChildren_0: [DynamicPartType, number][] = [[DynamicPartType.Children, 0]];

export const snapshotManager: {
  values: Map<string, Snapshot>;
} = {
  values: /* @__PURE__ */ new Map<string, Snapshot>([
    [
      'root',
      {
        create() {
          /* v8 ignore start */
          if (__JS__ && !__DEV__) {
            return [];
          }
          /* v8 ignore stop */
          return [__page!];
        },
        update: [],
        slot: __DynamicPartChildren_0,
        isListHolder: false,
        cssId: 0,
      },
    ],
    [
      'wrapper',
      {
        create() {
          /* v8 ignore start */
          if (__JS__ && !__DEV__) {
            return [];
          }
          /* v8 ignore stop */
          return [__CreateWrapperElement(__pageId)];
        },
        update: [],
        slot: __DynamicPartChildren_0,
        isListHolder: false,
      },
    ],
    [
      'mtc-container',
      {
        create() {
          /* v8 ignore start */
          if (__JS__ && !__DEV__) {
            return [];
          }
          /* v8 ignore stop */
          return [__CreateWrapperElement(__pageId)];
        },
        update: [() => {}],
        slot: __DynamicPartChildren_0,
        isListHolder: false,
      },
    ],
    [
      'ignore',
      {
        create() {
          /* v8 ignore start */
          if (__JS__ && !__DEV__) {
            return [];
          }
          /* v8 ignore stop */
          return [__CreateWrapperElement(__pageId)];
        },
        update: [],
        slot: __DynamicPartChildren_0,
        isListHolder: false,
        // isIgnore: true,
      },
    ],
    [
      null as unknown as string,
      {
        create() {
          /* v8 ignore start */
          if (__JS__ && !__DEV__) {
            return [];
          }
          /* v8 ignore stop */
          return [__CreateElement('raw-text', __pageId)];
        },
        update: [
          ctx => {
            /* v8 ignore start */
            if (__JS__ && !__DEV__) {
              return;
            }
            /* v8 ignore stop */
            if (ctx.__elements) {
              __SetAttribute(ctx.__elements[0]!, 'text', ctx.__values![0]);
            }
          },
        ],
        slot: [],
        isListHolder: false,
      },
    ],
  ]),
};

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
  },
};

export const backgroundSnapshotInstanceManager: {
  nextId: number;
  values: Map<number, BackgroundSnapshotInstance>;
  clear(): void;
  updateId(id: number, newId: number): void;
  getValueBySign(str: string): unknown;
} = {
  nextId: 0,
  values: /* @__PURE__ */ new Map<number, BackgroundSnapshotInstance>(),
  clear() {
    // not resetting `nextId` to prevent id collision
    this.values.clear();
  },
  updateId(id: number, newId: number) {
    const values = this.values;
    const si = values.get(id)!;
    // For PreactDevtools, on first hydration,
    // PreactDevtools can get the real snapshot instance id in main-thread
    if (__DEV__) {
      lynx.getJSModule('GlobalEventEmitter').emit('onBackgroundSnapshotInstanceUpdateId', [
        {
          backgroundSnapshotInstance: si,
          oldId: id,
          newId,
        },
      ]);
    }
    values.delete(id);
    values.set(newId, si);
    si.__id = newId;
  },
  getValueBySign(str: string): unknown {
    const res = str?.split(':');
    if (!res || (res.length != 2 && res.length != 3)) {
      throw new Error('Invalid ctx format: ' + str);
    }
    const id = Number(res[0]);
    const expIndex = Number(res[1]);
    const ctx = this.values.get(id);
    if (!ctx) {
      return null;
    }
    const spreadKey = res[2];
    if (res[1] === '__extraProps') {
      if (spreadKey) {
        return ctx.__extraProps![spreadKey];
      }
      throw new Error('unreachable');
    } else {
      if (spreadKey) {
        return (ctx.__values![expIndex] as { [spreadKey]: unknown })[spreadKey];
      } else {
        return ctx.__values![expIndex];
      }
    }
  },
};

export function entryUniqID(uniqID: string, entryName?: string): string {
  return entryName ? `${entryName}:${uniqID}` : uniqID;
}

export function createSnapshot(
  uniqID: string,
  create: Snapshot['create'] | null,
  update: Snapshot['update'] | null,
  slot: Snapshot['slot'],
  cssId: number | undefined,
  entryName: string | undefined,
  refAndSpreadIndexes: number[] | null,
): string {
  if (
    __DEV__ && __JS__
    // `__globalSnapshotPatch` does not exist before hydration,
    // so the snapshot of the first screen will not be sent to the main thread.
    && __globalSnapshotPatch
    && !snapshotManager.values.has(entryUniqID(uniqID, entryName))
    // `create` may be `null` when loading a lazy bundle after hydration.
    && create !== null
  ) {
    // We only update the lepus snapshot if the `uniqID` is different.
    // This means that `uniqID` is considered the "hash" of the snapshot.
    // When HMR (Hot Module Replacement) or fast refresh updates occur, `createSnapshot` will be re-executed with the new snapshot definition.
    __globalSnapshotPatch.push(
      SnapshotOperation.DEV_ONLY_AddSnapshot,
      uniqID,
      // We use `Function.prototype.toString` to serialize the `create` and `update` functions for Lepus.
      // This allows the updates to be applied to Lepus.
      // As a result, both the static part (`create`) and the dynamic parts (`update` and `slot`) can be updated.
      create.toString(),
      update?.map(f => f.toString()) ?? [],
      slot,
      cssId,
      entryName,
    );
  }

  uniqID = entryUniqID(uniqID, entryName);

  const s: Snapshot = { create, update, slot, cssId, entryName, refAndSpreadIndexes };
  snapshotManager.values.set(uniqID, s);
  if (slot && slot[0] && slot[0][0] === DynamicPartType.ListChildren) {
    s.isListHolder = true;
  }
  return uniqID;
}

export interface WithChildren {
  childNodes: WithChildren[];
}

export function traverseSnapshotInstance<I extends WithChildren>(
  si: I,
  callback: (si: I) => void,
): void {
  const c = si.childNodes;
  callback(si);
  for (const vv of c) {
    traverseSnapshotInstance(vv as I, callback);
  }
}

export interface SerializedSnapshotInstance {
  id: number;
  type: string;
  values?: any[] | undefined;
  extraProps?: Record<string, unknown> | undefined;
  children?: SerializedSnapshotInstance[] | undefined;
}

const DEFAULT_ENTRY_NAME = '__Card__';
const DEFAULT_CSS_ID = 0;

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
  __current_slot_index = 0;
  __worklet_ref_set?: Set<WorkletRefImpl<any> | Worklet>;
  __listItemPlatformInfo?: PlatformInfo;
  __extraProps?: Record<string, unknown> | undefined;
  __onDestroy?: () => void;

  constructor(public type: string, id?: number) {
    this.__snapshot_def = snapshotManager.values.get(type)!;
    // Suspense uses 'div'
    if (!this.__snapshot_def && type !== 'div') {
      throw new Error('Snapshot not found: ' + type);
    }

    id ??= snapshotInstanceManager.nextId -= 1;
    this.__id = id;
    snapshotInstanceManager.values.set(id, this);
    // if (type === 'ignore') {
    //   this.insertBefore = () => {};
    //   this.removeChild = () => {};
    // }
  }

  ensureElements(): void {
    // console.log('zzzz ensureElements', this.__id, this.type);
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

    __pendingListUpdates.runWithoutUpdates(() => {
      const values = this.__values;
      if (values) {
        this.__values = undefined;
        this.setAttribute('values', values);
      }
    });

    if (isListHolder) {
      // never recurse into list's children
    } else {
      let index = 0;
      let child = this.__firstChild;
      while (child) {
        if (child.__elements === undefined) {
          child.ensureElements();

          const [type, elementIndex] = slot[index]!;
          switch (type) {
            case DynamicPartType.Slot: {
              // console.log('zzzz __ReplaceElement 2', child.__id);
              __ReplaceElement(child.__element_root!, elements[elementIndex]!);
              elements[elementIndex] = child.__element_root!;
              index++;
              break;
            }
            /* v8 ignore start */
            case DynamicPartType.MultiChildren: {
              if (__GetTag(elements[elementIndex]!) === 'wrapper') {
                // console.log('zzzz __ReplaceElement 3', child.__id);
                __ReplaceElement(child.__element_root!, elements[elementIndex]!);
              } else {
                // console.log('zzzz __AppendElement 3', this.__id, child.__id);
                __AppendElement(elements[elementIndex]!, child.__element_root!);
              }
              index++;
              break;
            }
            /* v8 ignore end */
            case DynamicPartType.Children:
            case DynamicPartType.ListChildren: {
              // console.log('zzzz __AppendElement 4', this.__id, child.__id);
              __AppendElement(elements[elementIndex]!, child.__element_root!);
              break;
            }
          }
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
      v.__onDestroy?.();
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
    // console.log('yra insertBefore', this.__id, newNode.__id);
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
    const oldParent = newNode.__parent;
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
    if (count === 1) {
      const [, elementIndex] = __snapshot_def.slot[0]!;
      const parent = __elements[elementIndex]!;
      if (shouldRemove) {
        // console.log('zzzz __RemoveElement 3', this.__id, newNode.__id);
        __RemoveElement(parent, newNode.__element_root!);
      } else if (oldParent && oldParent.__element_root) {
        // console.log('zzzz __RemoveElement 2', oldParent.__id, newNode.__id);
        __RemoveElement(oldParent.__element_root, newNode.__element_root!);
      }
      if (existingNode) {
        // console.log('zzzz __InsertElementBefore 1', this.__id, newNode.__id);
        __InsertElementBefore(
          parent,
          newNode.__element_root!,
          existingNode.__element_root,
        );
      } else {
        // console.log('zzzz __AppendElement 1', this.__id, newNode.__id);
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
          // console.log('zzzz __AppendElement 2', this.__id, newNode.__id);
          __AppendElement(__elements[elementIndex]!, newNode.__element_root!);
        }
      }
      /* v8 ignore end */
    }
  }

  removeChild(child: SnapshotInstance, options?: { keepSubTree: boolean }): void {
    const __snapshot_def = this.__snapshot_def;
    if (__snapshot_def.isListHolder) {
      if (__pendingListUpdates.values) {
        (__pendingListUpdates.values[this.__id] ??= new ListUpdateInfoRecording(
          this,
        )).onRemoveChild(child);
      }

      this.__removeChild(child);
      traverseSnapshotInstance(child, v => {
        v.__onDestroy?.();
        snapshotInstanceManager.values.delete(v.__id);
      });
      // mark this child as deleted
      child.__id = 0;
      return;
    }

    unref(child, true);
    if (this.__elements) {
      const [, elementIndex] = __snapshot_def.slot[0]!;
      // console.log('zzzz __RemoveElement 4', this.__id, child.__id);
      __RemoveElement(this.__elements[elementIndex]!, child.__element_root!);
    }

    if (child.__snapshot_def.isListHolder) {
      snapshotDestroyList(child);
    }

    this.__removeChild(child);
    if (!options?.keepSubTree) {
      traverseSnapshotInstance(child, v => {
        v.__onDestroy?.();
        v.__parent = null;
        v.__previousSibling = null;
        v.__nextSibling = null;
        delete v.__elements;
        delete v.__element_root;
        snapshotInstanceManager.values.delete(v.__id);
      });
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
    return {
      id: this.__id,
      type: this.type,
      values: this.__values,
      extraProps: this.__extraProps,
      children: this.__firstChild ? this.childNodes : undefined,
    };
  }

  callUpdateIfNotDirectOrDeepEqual(index: number, oldValue: any, newValue: any): void {
    if (isDirectOrDeepEqual(oldValue, newValue)) {}
    else if (newValue?.__MTCProps) {
      renderMTC(this, newValue as MTCProps);
    } else {
      this.__snapshot_def.update![index]!(this, index, oldValue);
    }
  }
}

interface MTCProps extends Attributes {
  __MTCProps: {
    componentTypeId: string;
    componentInstanceId: string;
  };

  [key: string]: any;
}

function renderMTC(snapshotInstance: SnapshotInstance, props: MTCProps) {
  // console.log('yra renderMTC', snapshotInstance.__id, props);
  if (snapshotInstance.__elements === undefined) {
    return;
  }
  const instanceId = props.__MTCProps.componentInstanceId;
  transformMTCProps(props);
  // if (mtcComponentVNodes.has(instanceId)) {
  //   const [vnode, wrapper, wrapperElement] = mtcComponentVNodes.get(instanceId)!;
  //   const newVnode = cloneElement(vnode, props);
  //   wrapper.insertBefore(wrapperElement);
  //   const wrapperVNode = createVNode('wrapper', { children: newVnode }) as VNode;
  //   render(wrapperVNode, wrapper as unknown as ContainerNode);
  //   snapshotInstance.insertBefore(wrapperVNode.__e as SnapshotInstance);
  //   mtcComponentVNodes.set(instanceId, [newVnode, wrapper, wrapperVNode.__e as SnapshotInstance]);
  // } else {
  //   const type = mtcComponentTypes.get(props.__MTCProps.componentTypeId)!;
  //   const newProps = { ...props };
  //   // const vnode = createVNode('wrapper', { children: createVNode(type, newProps) }) as VNode;
  //   const vnode = createVNode(type, newProps) as VNode;
  //   const wrapper = new SnapshotInstance('wrapper');
  //   // @ts-ignore
  //   wrapper.nodeType = 1;
  //   const wrapperVNode = createVNode('wrapper', { children: vnode }) as VNode;
  //   render(wrapperVNode, wrapper as unknown as ContainerNode);
  //   wrapper.ensureElements();
  //   // console.log('yra renderMTC render-1', vnode.__e, vnode.__e !== undefined);
  //   if (vnode.__e) {
  //     mtcComponentVNodes.set(instanceId, [vnode, wrapper, wrapperVNode.__e as SnapshotInstance]);
  //     snapshotInstance.insertBefore(wrapperVNode.__e as SnapshotInstance);
  //     (wrapperVNode.__e as SnapshotInstance).__onDestroy = () => {
  //       wrapper.insertBefore(wrapperVNode.__e as SnapshotInstance);
  //       unmountComponentAtNode(wrapper as unknown as ContainerNode);
  //       // TODO: destroy wrapper
  //       mtcComponentVNodes.delete(instanceId);
  //     };
  //   }
  // }
  if (mtcComponentVNodes.has(instanceId)) {
    const [vnode, wrapper] = mtcComponentVNodes.get(instanceId)!;
    const newVnode = cloneElement(vnode, props);
    wrapper.insertBefore(vnode.__e as SnapshotInstance);

    // console.log('zzzz renderMTC render update', vnode.__e, vnode.__e !== undefined);
    // console.debug('********** renderMTC render update before:');
    // printSnapshotInstance(snapshotInstanceManager.values.get(-1)!);
    // console.debug('********** renderMTC render update wrapper before:');
    // printSnapshotInstance(wrapper);
    render(newVnode, wrapper as unknown as ContainerNode);
    // console.debug('********** renderMTC render update after:');
    // printSnapshotInstance(snapshotInstanceManager.values.get(-1)!);
    // console.debug('********** renderMTC render update wrapper after:');
    // printSnapshotInstance(wrapper);

    // console.log('zzzz renderMTC update insertBefore', snapshotInstance.__id, vnode.__e!.__id);
    snapshotInstance.insertBefore(newVnode.__e as SnapshotInstance);
    mtcComponentVNodes.set(instanceId, [newVnode, wrapper]);
  } else {
    const type = mtcComponentTypes.get(props.__MTCProps.componentTypeId)!;
    const newProps = { ...props };
    // const vnode = createVNode('wrapper', { children: createVNode(type, newProps) }) as VNode;
    const vnode = createVNode(type, newProps) as VNode;
    const wrapper = new SnapshotInstance('wrapper');
    mtcComponentVNodes.set(instanceId, [vnode, wrapper]);
    // @ts-ignore
    wrapper.nodeType = 1;
    render(vnode, wrapper as unknown as ContainerNode);
    // console.log('zzzz renderMTC ensureElements', wrapper.__id);
    // wrapper.ensureElements();
    // console.log('yra renderMTC render-1', vnode.__e, vnode.__e !== undefined);
    if (vnode.__e) {
      // @ts-ignore
      vnode.__e.toJSON = function(this: SnapshotInstance) {
        return undefined;
      };
      // console.log('zzzz renderMTC create insertBefore', snapshotInstance.__id, vnode.__e.__id);
      snapshotInstance.insertBefore(vnode.__e as SnapshotInstance);
      (vnode.__e as SnapshotInstance).__onDestroy = () => {
        // console.log('zzzz renderMTC __onDestroy', vnode.__e!.__id);
        delete (vnode.__e as SnapshotInstance).__onDestroy;
        wrapper.insertBefore(vnode.__e as SnapshotInstance);
        unmountComponentAtNode(wrapper as unknown as ContainerNode);
        // TODO: destroy wrapper
        mtcComponentVNodes.delete(instanceId);
      };
    }
  }
}
