// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Background snapshot implementation that runs in the background thread.
 *
 * This is the mirror of main thread's {@link SnapshotInstance}:
 */

import type { VNode } from 'preact';

import type { Worklet } from '@lynx-js/react/worklet-runtime/bindings';

import { profileEnd, profileStart } from './debug/utils.js';
import { processGestureBackground } from './gesture/processGestureBagkround.js';
import type { GestureKind } from './gesture/types.js';
import { diffArrayAction, diffArrayLepus } from './hydrate.js';
import { globalBackgroundSnapshotInstancesToRemove } from './lifecycle/patch/commit.js';
import type { SnapshotPatch } from './lifecycle/patch/snapshotPatch.js';
import {
  SnapshotOperation,
  __globalSnapshotPatch,
  initGlobalSnapshotPatch,
  takeGlobalSnapshotPatch,
} from './lifecycle/patch/snapshotPatch.js';
import { globalPipelineOptions } from './lynx/performance.js';
import { DynamicPartType } from './snapshot/dynamicPartType.js';
import { applyRef, clearQueuedRefs, queueRefAttrUpdate } from './snapshot/ref.js';
import type { Ref } from './snapshot/ref.js';
import { transformSpread } from './snapshot/spread.js';
import type { SerializedSnapshotInstance, Snapshot } from './snapshot.js';
import { backgroundSnapshotInstanceManager, snapshotManager, traverseSnapshotInstance } from './snapshot.js';
import { hydrationMap } from './snapshotInstanceHydrationMap.js';
import { isDirectOrDeepEqual } from './utils.js';
import { onPostWorkletCtx } from './worklet/ctx.js';

export interface BackgroundDOM extends VNode {
  type: string;
  __id: number;
  __values: any[] | undefined;
  __snapshot_def: Snapshot;
  __extraProps?: Record<string, unknown> | undefined;
  __removed_from_tree?: boolean;

  parentNode: BackgroundDOM | null;
  previousSibling: BackgroundDOM | null;
  nextSibling: BackgroundDOM | null;
  firstChild: BackgroundDOM | null;
  lastChild: BackgroundDOM | null;

  childNodes: BackgroundDOM[];

  contains: (child: BackgroundDOM) => boolean;
  appendChild: (child: BackgroundDOM) => void;
  insertBefore: (node: BackgroundDOM, beforeNode?: BackgroundDOM) => void;
  removeChild: (node: BackgroundDOM) => void;
  setAttribute(key: string | number, value: unknown): void;
}

export function hydrate(
  before: SerializedSnapshotInstance,
  after: BackgroundDOM,
): SnapshotPatch {
  initGlobalSnapshotPatch();

  const helper = (
    before: SerializedSnapshotInstance,
    after: BackgroundDOM,
  ) => {
    hydrationMap.set(after.__id, before.id);
    backgroundSnapshotInstanceManager.updateId(after.__id, before.id);
    after.__values?.forEach((value: unknown, index) => {
      const old: unknown = before.values![index];

      if (value) {
        if (typeof value === 'object') {
          if ('__spread' in value) {
            // `value.__spread` my contain event ids using snapshot ids before hydration. Remove it.
            delete value.__spread;
            const __spread = transformSpread(after, index, value);
            for (const key in __spread) {
              const v = __spread[key];
              if (v && typeof v === 'object') {
                if ('_wkltId' in v) {
                  onPostWorkletCtx(v as Worklet);
                } else if ('__isGesture' in v) {
                  processGestureBackground(v as GestureKind);
                }
              }
            }
            (after.__values![index]! as Record<string, unknown>)['__spread'] = __spread;
            value = __spread;
          } else if ('__ref' in value) {
            // skip patch
            value = old;
          } else if ('_wkltId' in value) {
            onPostWorkletCtx(value as Worklet);
          } else if ('__isGesture' in value) {
            processGestureBackground(value as GestureKind);
          }
        } else if (typeof value === 'function') {
          if ('__ref' in value) {
            // skip patch
            value = old;
          } else {
            value = `${after.__id}:${index}:`;
          }
        }
      }

      if (!isDirectOrDeepEqual(value, old)) {
        if (value === undefined && old === null) {
          // This is a workaround for the case where we set an attribute to `undefined` in the main thread,
          // but the old value becomes `null` during JSON serialization.
          // In this case, we should not patch the value.
        } else {
          __globalSnapshotPatch!.push(
            SnapshotOperation.SetAttribute,
            after.__id,
            index,
            value,
          );
        }
      }
    });

    if (after.__extraProps) {
      for (const key in after.__extraProps) {
        const value = after.__extraProps[key];
        const old = before.extraProps?.[key];
        if (!isDirectOrDeepEqual(value, old)) {
          __globalSnapshotPatch!.push(
            SnapshotOperation.SetAttribute,
            after.__id,
            key,
            value,
          );
        }
      }
    }

    const { slot } = after.__snapshot_def;

    const beforeChildNodes = before.children ?? [];
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
              reconstructInstanceTree([node], before.id, target?.id);
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
  // Hydration should not trigger ref updates. They were incorrectly triggered when using `setAttribute` to add values to the patch list.
  clearQueuedRefs();
  return takeGlobalSnapshotPatch()!;
}

function reconstructInstanceTree(afters: BackgroundDOM[], parentId: number, targetId?: number): void {
  for (const child of afters) {
    const id = child.__id;
    __globalSnapshotPatch?.push(SnapshotOperation.CreateElement, child.type, id);
    const values = child.__values;
    if (values) {
      child.__values = undefined;
      child.setAttribute('values', values);
    }
    const extraProps = child.__extraProps;
    for (const key in extraProps) {
      child.setAttribute(key, extraProps[key]);
    }
    reconstructInstanceTree(child.childNodes, id);
    __globalSnapshotPatch?.push(SnapshotOperation.InsertBefore, parentId, id, targetId);
  }
}

function contains(this: BackgroundDOM, child: BackgroundDOM): boolean {
  return child.parentNode === this;
}

function appendChild(this: BackgroundDOM, child: BackgroundDOM): void {
  return this.insertBefore(child);
}

function insertBefore(this: BackgroundDOM, node: BackgroundDOM, beforeNode?: BackgroundDOM): void {
  if (node.__removed_from_tree) {
    node.__removed_from_tree = false;
    // This is only called by `lazy`/`Suspense` through `appendChild` so beforeNode is always undefined.
    /* v8 ignore next */
    reconstructInstanceTree([node], this.__id, beforeNode?.__id);
  } else {
    __globalSnapshotPatch?.push(
      SnapshotOperation.InsertBefore,
      this.__id,
      node.__id,
      beforeNode?.__id,
    );
  }

  // If the node already has a parent, remove it from its current parent
  const p = node.parentNode;
  if (p) {
    if (node.previousSibling) {
      node.previousSibling.nextSibling = node.nextSibling;
    } else {
      p.firstChild = node.nextSibling;
    }

    if (node.nextSibling) {
      node.nextSibling.previousSibling = node.previousSibling;
    } else {
      p.lastChild = node.previousSibling;
    }
  }

  // If beforeNode is not provided, add the new node as the last child
  if (beforeNode) {
    // If beforeNode is provided, insert the new node before beforeNode
    if (beforeNode.previousSibling) {
      beforeNode.previousSibling.nextSibling = node;
      node.previousSibling = beforeNode.previousSibling;
    } else {
      this.firstChild = node;
      node.previousSibling = null;
    }
    beforeNode.previousSibling = node;
    node.nextSibling = beforeNode;
    node.parentNode = this;
  } else {
    if (this.lastChild) {
      this.lastChild.nextSibling = node;
      node.previousSibling = this.lastChild;
    } else {
      this.firstChild = node;
      node.previousSibling = null;
    }
    this.lastChild = node;
    node.parentNode = this;
    node.nextSibling = null;
  }
}

function removeChild(this: BackgroundDOM, node: BackgroundDOM): void {
  __globalSnapshotPatch?.push(
    SnapshotOperation.RemoveChild,
    this.__id,
    node.__id,
  );
  node.__removed_from_tree = true;

  if (node.parentNode !== this) {
    throw new Error('The node to be removed is not a child of this node.');
  }

  if (node.previousSibling) {
    node.previousSibling.nextSibling = node.nextSibling;
  } else {
    this.firstChild = node.nextSibling;
  }

  if (node.nextSibling) {
    node.nextSibling.previousSibling = node.previousSibling;
  } else {
    this.lastChild = node.previousSibling;
  }

  node.parentNode = null;
  node.previousSibling = null;
  node.nextSibling = null;

  queueRefAttrUpdate(
    () => {
      traverseSnapshotInstance(node, v => {
        if (v.__values) {
          v.__snapshot_def.refAndSpreadIndexes?.forEach((i) => {
            const value = v.__values![i] as unknown;
            if (value && (typeof value === 'object' || typeof value === 'function')) {
              if ('__spread' in value && 'ref' in value) {
                applyRef(value.ref as Ref, null);
              } else if ('__ref' in value) {
                applyRef(value as Ref, null);
              }
            }
          });
        }
      });
    },
    null,
    0,
    0,
  );

  globalBackgroundSnapshotInstancesToRemove.push(node.__id);
}

function setAttribute(this: BackgroundDOM, key: string | number, value: unknown): void {
  if (__PROFILE__) {
    profileStart('ReactLynx::BSI::setAttribute');
  }
  if (key === 'values') {
    if (__globalSnapshotPatch) {
      const oldValues = this.__values;
      if (oldValues) {
        for (let index = 0; index < (value as unknown[]).length; index++) {
          const { needUpdate, valueToCommit } = setAttributeImpl(
            this,
            (value as unknown[])[index],
            oldValues[index],
            index,
          );
          if (needUpdate) {
            __globalSnapshotPatch.push(
              SnapshotOperation.SetAttribute,
              this.__id,
              index,
              valueToCommit,
            );
          }
        }
      } else {
        const patch = [];
        const length = (value as unknown[]).length;
        for (let index = 0; index < length; ++index) {
          const { valueToCommit } = setAttributeImpl(this, (value as unknown[])[index], null, index);
          patch[index] = valueToCommit;
        }
        __globalSnapshotPatch.push(
          SnapshotOperation.SetAttributes,
          this.__id,
          patch,
        );
      }
    } else {
      this.__snapshot_def.refAndSpreadIndexes?.forEach((index) => {
        const v = (value as unknown[])[index];
        if (v && (typeof v === 'object' || typeof v === 'function')) {
          if ('__spread' in v && 'ref' in v) {
            queueRefAttrUpdate(null, v.ref as Ref, this.__id, index);
          } else if ('__ref' in v) {
            queueRefAttrUpdate(null, v as Ref, this.__id, index);
          }
        }
      });
    }
    this.__values = value as unknown[];
    if (__PROFILE__) {
      profileEnd();
    }
    return;
  }

  if (typeof key === 'string') {
    (this.__extraProps ??= {})[key] = value;
  } else {
    // old path (`this.setAttribute(0, xxx)`)
    // is reserved as slow path
    (this.__values ??= [])[key] = value;
  }
  __globalSnapshotPatch?.push(
    SnapshotOperation.SetAttribute,
    this.__id,
    key,
    value,
  );
  if (__PROFILE__) {
    profileEnd();
  }
}

function setAttributeImpl(dom: BackgroundDOM, newValue: unknown, oldValue: unknown, index: number): {
  needUpdate: boolean;
  valueToCommit: unknown;
} {
  if (!newValue) {
    // `oldValue` can't be a spread.
    if (oldValue && typeof oldValue === 'object' && '__ref' in oldValue) {
      queueRefAttrUpdate(oldValue as Ref, null, dom.__id, index);
    }
    return { needUpdate: oldValue !== newValue, valueToCommit: newValue };
  }

  const newType = typeof newValue;
  if (newType === 'object') {
    const newValueObj = newValue as Record<string, unknown>;
    if ('__spread' in newValueObj) {
      const oldSpread = (oldValue as { __spread?: Record<string, unknown> } | undefined)?.__spread;
      const newSpread = transformSpread(dom, index, newValueObj);
      const needUpdate = !isDirectOrDeepEqual(oldSpread, newSpread);
      // use __spread to cache the transform result for next diff
      newValueObj['__spread'] = newSpread;
      queueRefAttrUpdate(
        oldSpread && ((oldValue as { ref?: Ref }).ref),
        newValueObj['ref'] as Ref,
        dom.__id,
        index,
      );
      if (needUpdate) {
        for (const key in newSpread) {
          const newSpreadValue = newSpread[key];
          if (!newSpreadValue) {
            continue;
          }
          if ((newSpreadValue as { _wkltId?: string })._wkltId) {
            newSpread[key] = onPostWorkletCtx(newSpreadValue as Worklet);
          } else if ((newSpreadValue as { __isGesture?: boolean }).__isGesture) {
            processGestureBackground(newSpreadValue as GestureKind);
          } else if (key == '__lynx_timing_flag' && oldSpread?.[key] != newSpreadValue && globalPipelineOptions) {
            globalPipelineOptions.needTimestamps = true;
          }
        }
      }
      return { needUpdate, valueToCommit: newSpread };
    }
    if ('__ref' in newValueObj) {
      queueRefAttrUpdate(oldValue as Ref, newValueObj as Ref, dom.__id, index);
      return { needUpdate: false, valueToCommit: 1 };
    }
    if ('_wkltId' in newValueObj) {
      return { needUpdate: true, valueToCommit: onPostWorkletCtx(newValueObj as Worklet) };
    }
    if ('__isGesture' in newValueObj) {
      processGestureBackground(newValueObj as unknown as GestureKind);
      return { needUpdate: true, valueToCommit: newValue };
    }
    if ('__ltf' in newValueObj) {
      // __lynx_timing_flag
      if (globalPipelineOptions && (oldValue as { __ltf?: unknown } | undefined)?.__ltf != newValueObj['__ltf']) {
        globalPipelineOptions.needTimestamps = true;
        return { needUpdate: true, valueToCommit: newValue };
      }
      return { needUpdate: false, valueToCommit: newValue };
    }
    return { needUpdate: !isDirectOrDeepEqual(oldValue, newValue), valueToCommit: newValue };
  }
  if (newType === 'function') {
    if ((newValue as { __ref?: unknown }).__ref) {
      queueRefAttrUpdate(oldValue as Ref, newValue as Ref, dom.__id, index);
      return { needUpdate: false, valueToCommit: 1 };
    }
    /* event */
    return { needUpdate: !oldValue, valueToCommit: 1 };
  }
  return { needUpdate: oldValue !== newValue, valueToCommit: newValue };
}

const childNodesGetter = {
  get(this: BackgroundDOM) {
    const nodes: BackgroundDOM[] = [];
    let node = this.firstChild;
    while (node) {
      nodes.push(node);
      if (node === this.lastChild) {
        break;
      }
      node = node.nextSibling;
    }
    return nodes;
  },
};

export function setupDom(vnode: BackgroundDOM): BackgroundDOM {
  const type = vnode.type;
  vnode.__snapshot_def = snapshotManager.values.get(type)!;
  const id = vnode.__id = backgroundSnapshotInstanceManager.nextId += 1;
  __globalSnapshotPatch?.push(SnapshotOperation.CreateElement, type, id);

  vnode.contains = contains;
  vnode.appendChild = appendChild;
  vnode.insertBefore = insertBefore;
  vnode.removeChild = removeChild;
  vnode.setAttribute = setAttribute;
  vnode.parentNode = null;
  vnode.previousSibling = null;
  vnode.nextSibling = null;
  vnode.firstChild = null;
  vnode.lastChild = null;

  Object.defineProperty(vnode, 'childNodes', childNodesGetter);

  backgroundSnapshotInstanceManager.values.set(id, vnode);
  return vnode;
}
