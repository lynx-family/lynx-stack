// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Worklet } from '@lynx-js/react/worklet-runtime/bindings';

import { diffArrayAction, diffArrayLepus } from './hydrate.js';
import { globalBackgroundSnapshotInstancesToRemove } from './lifecycle/patch/commit.js';
import { markRefToRemove } from './snapshot/ref.js';
import { transformSpread } from './snapshot/spread.js';
import {
  DynamicPartType,
  backgroundSnapshotInstanceManager,
  snapshotManager,
  traverseSnapshotInstance,
} from './snapshot.js';
import type { SerializedSnapshotInstance } from './snapshot.js';
import {
  SnapshotOperation,
  __globalSnapshotPatch,
  initGlobalSnapshotPatch,
  takeGlobalSnapshotPatch,
} from './lifecycle/patch/snapshotPatch.js';
import type { SnapshotPatch } from './lifecycle/patch/snapshotPatch.js';
import { isDirectOrDeepEqual } from './utils.js';
import { onPostWorkletCtx } from './worklet/ctx.js';
import { processGestureBackground } from './gesture/processGestureBagkround.js';
import type { GestureKind } from './gesture/types.js';
import { globalPipelineOptions } from './lynx/performance.js';

export class BackgroundSnapshotInstance {
  constructor(public type: string) {
    let id;
    id = this.__id = backgroundSnapshotInstanceManager.nextId += 1;
    backgroundSnapshotInstanceManager.values.set(id, this);

    __globalSnapshotPatch?.push(SnapshotOperation.CreateElement, type, id);
  }

  __id: number;
  __values: any[] | undefined;

  private __parent: BackgroundSnapshotInstance | null = null;
  private __firstChild: BackgroundSnapshotInstance | null = null;
  private __lastChild: BackgroundSnapshotInstance | null = null;
  private __previousSibling: BackgroundSnapshotInstance | null = null;
  private __nextSibling: BackgroundSnapshotInstance | null = null;

  get parentNode(): BackgroundSnapshotInstance | null {
    return this.__parent;
  }

  get nextSibling(): BackgroundSnapshotInstance | null {
    return this.__nextSibling;
  }

  // get isConnected() {
  //   return !!this.__parent;
  // }

  contains(child: BackgroundSnapshotInstance): boolean {
    return child.parentNode === this;
  }

  // TODO: write tests for this
  // This will be called in `lazy`/`Suspense`.
  // We currently ignore this since we did not find a way to test.
  /* v8 ignore start */
  appendChild(child: BackgroundSnapshotInstance): void {
    return this.insertBefore(child);
  }
  /* v8 ignore stop */

  insertBefore(
    node: BackgroundSnapshotInstance,
    beforeNode?: BackgroundSnapshotInstance,
  ): void {
    __globalSnapshotPatch?.push(
      SnapshotOperation.InsertBefore,
      this.__id,
      node.__id,
      beforeNode?.__id,
    );

    // If the node already has a parent, remove it from its current parent
    const p = node.__parent;
    if (p) {
      if (node.__previousSibling) {
        node.__previousSibling.__nextSibling = node.__nextSibling;
      } else {
        p.__firstChild = node.__nextSibling;
      }

      if (node.__nextSibling) {
        node.__nextSibling.__previousSibling = node.__previousSibling;
      } else {
        p.__lastChild = node.__previousSibling;
      }
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

  removeChild(node: BackgroundSnapshotInstance): void {
    __globalSnapshotPatch?.push(
      SnapshotOperation.RemoveChild,
      this.__id,
      node.__id,
    );

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

    traverseSnapshotInstance(node, v => {
      v.__parent = null;
      globalBackgroundSnapshotInstancesToRemove.push(v.__id);
    });
  }

  get childNodes(): BackgroundSnapshotInstance[] {
    const nodes: BackgroundSnapshotInstance[] = [];
    let node = this.__firstChild;
    while (node) {
      nodes.push(node);
      if (node === this.__lastChild) {
        break;
      }
      node = node.__nextSibling;
    }
    return nodes;
  }

  setAttribute(key: string | number, value: any): void {
    if (__PROFILE__) {
      console.profile('setAttribute');
    }
    if (key === 'values') {
      if (__globalSnapshotPatch) {
        const oldValues = this.__values;
        if (oldValues) {
          for (let index = 0; index < value.length; index++) {
            const { needUpdate, valueToCommit } = this.setAttributeImpl(value[index], oldValues[index], index);
            if (needUpdate) {
              __globalSnapshotPatch?.push(
                SnapshotOperation.SetAttribute,
                this.__id,
                index,
                valueToCommit,
              );
            }
          }
        } else {
          const patch = [];
          const length = value.length;
          for (let index = 0; index < length; ++index) {
            const { valueToCommit } = this.setAttributeImpl(value[index], null, index);
            patch[index] = valueToCommit;
          }
          __globalSnapshotPatch?.push(
            SnapshotOperation.SetAttributes,
            this.__id,
            patch,
          );
        }
      }
      this.__values = value;
      if (__PROFILE__) {
        console.profileEnd();
      }
      return;
    }

    // old path (`<__snapshot_xxxx_xxxx __0={} __1={} />` or `this.setAttribute(0, xxx)`)
    // is reserved as slow path
    const index = typeof key === 'string' ? Number(key.slice(2)) : key;
    (this.__values ??= [])[index] = value;

    __globalSnapshotPatch?.push(
      SnapshotOperation.SetAttribute,
      this.__id,
      index,
      value,
    );
    if (__PROFILE__) {
      console.profileEnd();
    }
  }

  private setAttributeImpl(newValue: any, oldValue: any, index: number): {
    needUpdate: boolean;
    valueToCommit: any;
  } {
    if (!newValue) {
      if (oldValue && oldValue.__ref) {
        markRefToRemove(`${this.__id}:${index}:`, oldValue);
      }
      return { needUpdate: oldValue !== newValue, valueToCommit: newValue };
    }

    const newType = typeof newValue;
    if (newType === 'object') {
      if (newValue.__spread) {
        const oldSpread = oldValue ? oldValue.__spread : oldValue;
        const newSpread = transformSpread(this, index, newValue);
        const needUpdate = !isDirectOrDeepEqual(oldSpread, newSpread);
        // use __spread to cache the transform result for next diff
        newValue.__spread = newSpread;
        if (needUpdate) {
          if (oldSpread && oldSpread.ref) {
            markRefToRemove(`${this.__id}:${index}:ref`, oldValue.ref);
          }
          for (let key in newSpread) {
            const newSpreadValue = newSpread[key];
            if (!newSpreadValue) {
              continue;
            }
            if ((newSpreadValue as any)._wkltId) {
              newSpread[key] = onPostWorkletCtx(newSpreadValue as Worklet);
            } else if ((newSpreadValue as any).__isGesture) {
              processGestureBackground(newSpreadValue as GestureKind);
            } else if (key == '__lynx_timing_flag' && oldSpread?.[key] != newSpreadValue) {
              if (globalPipelineOptions) {
                globalPipelineOptions.needTimestamps = true;
              }
            }
          }
        }
        return { needUpdate, valueToCommit: newSpread };
      }
      if (newValue.__ref) {
        // force update to update ref value
        // TODO: ref: optimize this. The ref update maybe can be done on the background thread to reduce updating.
        // The old ref must have a place to be stored because it needs to be cleared when the main thread returns.
        markRefToRemove(`${this.__id}:${index}:`, oldValue);
        // update ref. On the main thread, the ref id will be replaced with value's sign when updating.
        return { needUpdate: true, valueToCommit: newValue.__ref };
      }
      if (newValue._wkltId) {
        return { needUpdate: true, valueToCommit: onPostWorkletCtx(newValue) };
      }
      if (newValue.__isGesture) {
        processGestureBackground(newValue);
        return { needUpdate: true, valueToCommit: newValue };
      }
      if (newValue.__ltf) {
        // __lynx_timing_flag
        if (globalPipelineOptions && oldValue?.__ltf != newValue.__ltf) {
          globalPipelineOptions.needTimestamps = true;
          return { needUpdate: true, valueToCommit: newValue };
        }
        return { needUpdate: false, valueToCommit: newValue };
      }
      return { needUpdate: !isDirectOrDeepEqual(oldValue, newValue), valueToCommit: newValue };
    }
    if (newType === 'function') {
      if (newValue.__ref) {
        markRefToRemove(`${this.__id}:${index}:`, oldValue);
        return { needUpdate: true, valueToCommit: newValue.__ref };
      }
      /* event */
      return { needUpdate: !oldValue, valueToCommit: 1 };
    }
    return { needUpdate: oldValue !== newValue, valueToCommit: newValue };
  }
}

export function hydrate(
  before: SerializedSnapshotInstance,
  after: BackgroundSnapshotInstance,
): SnapshotPatch {
  initGlobalSnapshotPatch();

  const helper2 = (afters: BackgroundSnapshotInstance[], parentId: number) => {
    for (const child of afters) {
      const id = child.__id;
      __globalSnapshotPatch!.push(SnapshotOperation.CreateElement, child.type, id);
      const values = child.__values;
      if (values) {
        child.__values = undefined;
        child.setAttribute('values', values);
      }
      helper2(child.childNodes, id);
      __globalSnapshotPatch!.push(SnapshotOperation.InsertBefore, parentId, id, undefined);
    }
  };

  const helper = (
    before: SerializedSnapshotInstance,
    after: BackgroundSnapshotInstance,
  ) => {
    backgroundSnapshotInstanceManager.updateId(after.__id, before.id);
    after.__values?.forEach((value, index) => {
      const old = before.values![index];

      if (value) {
        if (value.__spread) {
          // `value.__spread` my contain event ids using snapshot ids before hydration. Remove it.
          delete value.__spread;
          value = transformSpread(after, index, value);
          for (let key in value) {
            if (value[key] && value[key]._wkltId) {
              onPostWorkletCtx(value[key]);
            } else if (value[key] && value[key].__isGesture) {
              processGestureBackground(value[key] as GestureKind);
            }
          }
          after.__values![index]!.__spread = value;
        } else if (value.__ref) {
          if (old) {
            // skip patch
            value = old;
          } else {
            value = value.__ref;
          }
        } else if (typeof value === 'function') {
          value = `${after.__id}:${index}:`;
        }
      }

      if (value && value._wkltId) {
        onPostWorkletCtx(value);
      } else if (value && value.__isGesture) {
        processGestureBackground(value);
      }
      if (!isDirectOrDeepEqual(value, old)) {
        __globalSnapshotPatch!.push(
          SnapshotOperation.SetAttribute,
          after.__id,
          index,
          value,
        );
      }
    });

    const { slot } = snapshotManager.values.get(after.type)!;

    const beforeChildNodes = before.children || [];
    const afterChildNodes = after.childNodes;

    if (!slot) {
      return;
    }

    slot.forEach(([type], index) => {
      switch (type) {
        case DynamicPartType.Slot:
        case DynamicPartType.MultiChildren: {
          // TODO: the following null assertions are not 100% safe
          const v1 = beforeChildNodes[index]!;
          const v2 = afterChildNodes[index]!;
          helper(v1, v2);
          break;
        }
        case DynamicPartType.Children:
        case DynamicPartType.ListChildren: {
          const diffResult = diffArrayLepus(
            beforeChildNodes,
            afterChildNodes,
            (a, b) => a.type === b.type,
            (a, b) => {
              helper(a, b);
            },
          );
          diffArrayAction(
            beforeChildNodes,
            diffResult,
            (node, target) => {
              __globalSnapshotPatch!.push(
                SnapshotOperation.CreateElement,
                node.type,
                node.__id,
              );
              helper2(node.childNodes, node.__id);
              const values = node.__values;
              if (values) {
                node.__values = undefined;
                node.setAttribute('values', values);
              }
              __globalSnapshotPatch!.push(
                SnapshotOperation.InsertBefore,
                before.id,
                node.__id,
                target?.id,
              );
              return undefined as unknown as SerializedSnapshotInstance;
            },
            node => {
              __globalSnapshotPatch!.push(
                SnapshotOperation.RemoveChild,
                before.id,
                node.id,
              );
            },
            (node, target) => {
              // changedList.push([SnapshotOperation.RemoveChild, before.id, node.id]);
              __globalSnapshotPatch!.push(
                SnapshotOperation.InsertBefore,
                before.id,
                node.id,
                target?.id,
              );
            },
          );
          break;
        }
      }
    });
  };

  helper(before, after);
  return takeGlobalSnapshotPatch()!;
}
