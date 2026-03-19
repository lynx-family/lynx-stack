// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Background snapshot implementation that runs in the background thread.
 *
 * This is the mirror of main thread's {@link SnapshotInstance}:
 */

import type { ContainerNode, VNode } from 'preact';

import type { Worklet } from '@lynx-js/react/worklet-runtime/bindings';

import { profileEnd, profileStart } from './debug/profile.js';
import { getSnapshotVNodeSource } from './debug/vnodeSource.js';
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
import {
  backgroundSnapshotInstanceManager,
  snapshotCreatorMap,
  snapshotManager,
  traverseSnapshotInstance,
} from './snapshot.js';
import { hydrationMap } from './snapshotInstanceHydrationMap.js';
import { isDirectOrDeepEqual } from './utils.js';
import { onPostWorkletCtx } from './worklet/ctx.js';

export interface BackgroundDOM extends
  VNode,
  Omit<
    ContainerNode,
    | 'appendChild'
    | 'childNodes'
    | 'contains'
    | 'firstChild'
    | 'insertBefore'
    | 'nodeType'
    | 'parentNode'
    | 'removeChild'
  >
{
  type: string;
  nodeType: 1;
  parentNode: BackgroundDOM | null;
  firstChild: BackgroundDOM | null;
  lastChild: BackgroundDOM | null;
  previousSibling: BackgroundDOM | null;
  nextSibling: BackgroundDOM | null;
  childNodes: BackgroundDOM[];
  __id: number;
  __values: any[] | undefined;
  __snapshot_def: Snapshot;
  __extraProps?: Record<string, unknown> | undefined;
  __parent: BackgroundDOM | null;
  __firstChild: BackgroundDOM | null;
  __lastChild: BackgroundDOM | null;
  __previousSibling: BackgroundDOM | null;
  __nextSibling: BackgroundDOM | null;
  __removed_from_tree?: boolean;
  contains(other: ContainerNode | null): boolean;
  insertBefore(node: ContainerNode, child: ContainerNode | null): ContainerNode;
  appendChild(node: ContainerNode): ContainerNode;
  removeChild(child: ContainerNode): ContainerNode;
  tearDown(): void;
  setAttribute(key: string | number, value: unknown): void;
}

export class BackgroundSnapshotInstance {
  constructor(public type: string) {
    // Suspense uses 'div'
    if (!snapshotManager.values.has(type) && type !== 'div') {
      if (snapshotCreatorMap[type]) {
        snapshotCreatorMap[type](type);
      } else {
        throw new Error('BackgroundSnapshot not found: ' + type);
      }
    }
    this.__snapshot_def = snapshotManager.values.get(type)!;
    const id = this.__id = backgroundSnapshotInstanceManager.nextId += 1;
    backgroundSnapshotInstanceManager.values.set(id, this as unknown as BackgroundDOM);

    __globalSnapshotPatch?.push(SnapshotOperation.CreateElement, type, id);
  }

  __id: number;
  __values: any[] | undefined;
  __snapshot_def: Snapshot;
  __extraProps?: Record<string, unknown> | undefined;

  __parent: BackgroundDOM | null = null;
  __firstChild: BackgroundDOM | null = null;
  __lastChild: BackgroundDOM | null = null;
  __previousSibling: BackgroundDOM | null = null;
  __nextSibling: BackgroundDOM | null = null;
  __removed_from_tree?: boolean;

  get nodeType(): 1 {
    return 1;
  }

  set nodeType(_nodeType: 1) {}

  get parentNode(): BackgroundDOM | null {
    return this.__parent;
  }

  set parentNode(parentNode: BackgroundDOM | null) {
    this.__parent = parentNode;
  }

  get firstChild(): BackgroundDOM | null {
    return this.__firstChild;
  }

  set firstChild(firstChild: BackgroundDOM | null) {
    this.__firstChild = firstChild;
  }

  get lastChild(): BackgroundDOM | null {
    return this.__lastChild;
  }

  set lastChild(lastChild: BackgroundDOM | null) {
    this.__lastChild = lastChild;
  }

  get previousSibling(): BackgroundDOM | null {
    return this.__previousSibling;
  }

  set previousSibling(previousSibling: BackgroundDOM | null) {
    this.__previousSibling = previousSibling;
  }

  get nextSibling(): BackgroundDOM | null {
    return this.__nextSibling;
  }

  set nextSibling(nextSibling: BackgroundDOM | null) {
    this.__nextSibling = nextSibling;
  }

  // get isConnected() {
  //   return !!this.__parent;
  // }

  contains(child: ContainerNode | null): boolean {
    return (child as BackgroundDOM | null)?.parentNode === (this as unknown as BackgroundDOM);
  }

  // This will be called in `lazy`/`Suspense`.
  appendChild(child: ContainerNode): ContainerNode {
    return this.insertBefore(child, null);
  }

  insertBefore(
    node: ContainerNode,
    beforeNode: ContainerNode | null = null,
  ): ContainerNode {
    const backgroundNode = node as BackgroundDOM;
    const backgroundBeforeNode = beforeNode as BackgroundDOM | null;
    if (backgroundNode.__removed_from_tree) {
      backgroundNode.__removed_from_tree = false;
      // This is only called by `lazy`/`Suspense` through `appendChild` so beforeNode is always undefined.
      /* v8 ignore next */
      reconstructInstanceTree([backgroundNode], this.__id, backgroundBeforeNode?.__id);
    } else {
      __globalSnapshotPatch?.push(
        SnapshotOperation.InsertBefore,
        this.__id,
        backgroundNode.__id,
        backgroundBeforeNode?.__id,
      );
    }

    // If the node already has a parent, remove it from its current parent
    const p = backgroundNode.__parent;
    if (p) {
      if (backgroundNode.__previousSibling) {
        backgroundNode.__previousSibling.__nextSibling = backgroundNode.__nextSibling;
      } else {
        p.__firstChild = backgroundNode.__nextSibling;
      }

      if (backgroundNode.__nextSibling) {
        backgroundNode.__nextSibling.__previousSibling = backgroundNode.__previousSibling;
      } else {
        p.__lastChild = backgroundNode.__previousSibling;
      }
    }

    // If beforeNode is not provided, add the new node as the last child
    if (backgroundBeforeNode) {
      // If beforeNode is provided, insert the new node before beforeNode
      if (backgroundBeforeNode.__previousSibling) {
        backgroundBeforeNode.__previousSibling.__nextSibling = backgroundNode;
        backgroundNode.__previousSibling = backgroundBeforeNode.__previousSibling;
      } else {
        this.__firstChild = backgroundNode;
        backgroundNode.__previousSibling = null;
      }
      backgroundBeforeNode.__previousSibling = backgroundNode;
      backgroundNode.__nextSibling = backgroundBeforeNode;
      backgroundNode.__parent = this as unknown as BackgroundDOM;
    } else {
      if (this.__lastChild) {
        this.__lastChild.__nextSibling = backgroundNode;
        backgroundNode.__previousSibling = this.__lastChild;
      } else {
        this.__firstChild = backgroundNode;
        backgroundNode.__previousSibling = null;
      }
      this.__lastChild = backgroundNode;
      backgroundNode.__parent = this as unknown as BackgroundDOM;
      backgroundNode.__nextSibling = null;
    }

    return backgroundNode;
  }

  removeChild(node: ContainerNode): ContainerNode {
    const backgroundNode = node as BackgroundDOM;
    __globalSnapshotPatch?.push(
      SnapshotOperation.RemoveChild,
      this.__id,
      backgroundNode.__id,
    );
    backgroundNode.__removed_from_tree = true;

    if (backgroundNode.__parent !== (this as unknown as BackgroundDOM)) {
      throw new Error('The node to be removed is not a child of this node.');
    }

    if (backgroundNode.__previousSibling) {
      backgroundNode.__previousSibling.__nextSibling = backgroundNode.__nextSibling;
    } else {
      this.__firstChild = backgroundNode.__nextSibling;
    }

    if (backgroundNode.__nextSibling) {
      backgroundNode.__nextSibling.__previousSibling = backgroundNode.__previousSibling;
    } else {
      this.__lastChild = backgroundNode.__previousSibling;
    }

    backgroundNode.__parent = null;
    backgroundNode.__previousSibling = null;
    backgroundNode.__nextSibling = null;

    queueRefAttrUpdate(
      () => {
        traverseSnapshotInstance(backgroundNode, v => {
          if (v.__values) {
            v.__snapshot_def.refAndSpreadIndexes?.forEach((i) => {
              const value = v.__values![i] as unknown;
              if (value && (typeof value === 'object' || typeof value === 'function')) {
                if ('__spread' in value && 'ref' in value && value.ref) {
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

    globalBackgroundSnapshotInstancesToRemove.push(backgroundNode.__id);

    return backgroundNode;
  }

  tearDown(): void {
    traverseSnapshotInstance(this, v => {
      v.__parent = null;
      v.__previousSibling = null;
      v.__nextSibling = null;
      backgroundSnapshotInstanceManager.values.delete(v.__id);
    });
  }

  get childNodes(): BackgroundDOM[] {
    const nodes: BackgroundDOM[] = [];
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

  setAttribute(key: string | number, value: unknown): void {
    if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
      profileStart('ReactLynx::BSI::setAttribute');
    }
    if (key === 'values') {
      if (__globalSnapshotPatch) {
        const oldValues = this.__values;
        if (oldValues) {
          for (let index = 0; index < (value as unknown[]).length; index++) {
            const { needUpdate, valueToCommit } = this.setAttributeImpl(
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
            const { valueToCommit } = this.setAttributeImpl((value as unknown[])[index], null, index);
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
      if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
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
    if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
      profileEnd();
    }
  }

  private setAttributeImpl(newValue: unknown, oldValue: unknown, index: number): {
    needUpdate: boolean;
    valueToCommit: unknown;
  } {
    if (!newValue) {
      // `oldValue` can't be a spread.
      if (oldValue && typeof oldValue === 'object' && '__ref' in oldValue) {
        queueRefAttrUpdate(oldValue as Ref, null, this.__id, index);
      }
      return { needUpdate: oldValue !== newValue, valueToCommit: newValue };
    }

    const newType = typeof newValue;
    if (newType === 'object') {
      const newValueObj = newValue as Record<string, unknown>;
      if ('__spread' in newValueObj) {
        const oldSpread = (oldValue as { __spread?: Record<string, unknown> } | undefined)?.__spread;
        const newSpread = transformSpread(this as unknown as BackgroundDOM, index, newValueObj);
        const needUpdate = !isDirectOrDeepEqual(oldSpread, newSpread);
        // use __spread to cache the transform result for next diff
        newValueObj['__spread'] = newSpread;
        queueRefAttrUpdate(
          oldSpread && ((oldValue as { ref?: Ref }).ref),
          newValueObj['ref'] as Ref,
          this.__id,
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
        queueRefAttrUpdate(oldValue as Ref, newValueObj as Ref, this.__id, index);
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
        queueRefAttrUpdate(oldValue as Ref, newValue as Ref, this.__id, index);
        return { needUpdate: false, valueToCommit: 1 };
      }
      /* event */
      return { needUpdate: !oldValue, valueToCommit: 1 };
    }
    return { needUpdate: oldValue !== newValue, valueToCommit: newValue };
  }
}

export function hydrate(
  before: SerializedSnapshotInstance,
  after: BackgroundDOM,
): SnapshotPatch {
  const shouldProfile = typeof __PROFILE__ !== 'undefined' && __PROFILE__;
  if (shouldProfile) {
    profileStart('ReactLynx::BSI::hydrate');
  }
  try {
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
            if (shouldProfile) {
              profileStart('ReactLynx::hydrate::setAttribute', {
                args: {
                  id: String(after.__id),
                  snapshotType: String(after.type),
                  source: getSnapshotVNodeSource(after.__id) ?? '',
                  dynamicPartIndex: String(index),
                  valueType: value === null ? 'null' : typeof value,
                },
              });
              try {
                __globalSnapshotPatch!.push(
                  SnapshotOperation.SetAttribute,
                  after.__id,
                  index,
                  value,
                );
              } finally {
                profileEnd();
              }
            } else {
              __globalSnapshotPatch!.push(
                SnapshotOperation.SetAttribute,
                after.__id,
                index,
                value,
              );
            }
          }
        }
      });

      if (after.__extraProps) {
        for (const key in after.__extraProps) {
          const value = after.__extraProps[key];
          const old = before.extraProps?.[key];
          if (!isDirectOrDeepEqual(value, old)) {
            if (shouldProfile) {
              profileStart('ReactLynx::hydrate::setAttribute', {
                args: {
                  id: String(after.__id),
                  snapshotType: String(after.type),
                  source: getSnapshotVNodeSource(after.__id) ?? '',
                  dynamicPartIndex: key,
                  valueType: value === null ? 'null' : typeof value,
                },
              });
              try {
                __globalSnapshotPatch!.push(
                  SnapshotOperation.SetAttribute,
                  after.__id,
                  key,
                  value,
                );
              } finally {
                profileEnd();
              }
            } else {
              __globalSnapshotPatch!.push(
                SnapshotOperation.SetAttribute,
                after.__id,
                key,
                value,
              );
            }
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
              // Should be `false` in hydrate as SerializedSnapshotInstance has no item-key
              false,
            );
            diffArrayAction(
              beforeChildNodes,
              diffResult,
              (node, target) => {
                if (shouldProfile) {
                  profileStart('ReactLynx::BSI::reconstructInstanceTree', {
                    args: {
                      id: String(node.__id),
                      snapshotType: String(node.type),
                      source: getSnapshotVNodeSource(node.__id) ?? '',
                    },
                  });
                }
                try {
                  reconstructInstanceTree([node], before.id, target?.id);
                } finally {
                  if (shouldProfile) {
                    profileEnd();
                  }
                }
                return undefined as unknown as SerializedSnapshotInstance;
              },
              node => {
                if (shouldProfile) {
                  profileStart('ReactLynx::hydrate::removeChild', {
                    args: {
                      id: String(node.id),
                      snapshotType: String(node.type),
                      source: getSnapshotVNodeSource(node.id) ?? '',
                      parentId: String(before.id),
                    },
                  });
                  try {
                    __globalSnapshotPatch!.push(
                      SnapshotOperation.RemoveChild,
                      before.id,
                      node.id,
                    );
                  } finally {
                    profileEnd();
                  }
                } else {
                  __globalSnapshotPatch!.push(
                    SnapshotOperation.RemoveChild,
                    before.id,
                    node.id,
                  );
                }
              },
              (node, target) => {
                // changedList.push([SnapshotOperation.RemoveChild, before.id, node.id]);
                if (shouldProfile) {
                  profileStart('ReactLynx::hydrate::insertBefore', {
                    args: {
                      id: String(node.id),
                      snapshotType: String(node.type),
                      source: getSnapshotVNodeSource(node.id) ?? '',
                      parentId: String(before.id),
                      targetId: String(target?.id ?? ''),
                    },
                  });
                  try {
                    __globalSnapshotPatch!.push(
                      SnapshotOperation.InsertBefore,
                      before.id,
                      node.id,
                      target?.id,
                    );
                  } finally {
                    profileEnd();
                  }
                } else {
                  __globalSnapshotPatch!.push(
                    SnapshotOperation.InsertBefore,
                    before.id,
                    node.id,
                    target?.id,
                  );
                }
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
  } finally {
    if (shouldProfile) {
      profileEnd();
    }
  }
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

export function setupDom(vnode: VNode): BackgroundDOM {
  const dom = new BackgroundSnapshotInstance(vnode.type as string);
  const backgroundDom = Object.assign(vnode, dom) as BackgroundDOM;
  Object.setPrototypeOf(backgroundDom, BackgroundSnapshotInstance.prototype);
  backgroundSnapshotInstanceManager.values.set(dom.__id, backgroundDom);
  return backgroundDom;
}
