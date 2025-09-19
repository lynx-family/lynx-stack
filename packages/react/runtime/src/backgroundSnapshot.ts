// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Background snapshot implementation that runs in the background thread.
 *
 * This is the mirror of main thread's {@link SnapshotInstance}:
 */

import { profileEnd, profileStart } from './debug/utils.js';
import { diffArrayAction, diffArrayLepus } from './hydrate.js';
import { globalBackgroundSnapshotInstancesToRemove } from './lifecycle/patch/commit.js';
import type { SnapshotPatch } from './lifecycle/patch/snapshotPatch.js';
import {
  SnapshotOperation,
  __globalSnapshotPatch,
  initGlobalSnapshotPatch,
  takeGlobalSnapshotPatch,
} from './lifecycle/patch/snapshotPatch.js';
import { DynamicPartType } from './snapshot/dynamicPartType.js';
import { clearQueuedRefs } from './snapshot/ref.js';
import type { SerializedSnapshotInstance, Snapshot } from './snapshot.js';
import { backgroundSnapshotInstanceManager, snapshotManager, traverseSnapshotInstance } from './snapshot.js';
import { hydrationMap } from './snapshotInstanceHydrationMap.js';
import { isDirectOrDeepEqual } from './utils.js';

export class BackgroundSnapshotInstance {
  constructor(public type: string) {
    this.__snapshot_def = snapshotManager.values.get(type)!;
    const id = this.__id = backgroundSnapshotInstanceManager.nextId += 1;
    backgroundSnapshotInstanceManager.values.set(id, this);

    __globalSnapshotPatch?.push(SnapshotOperation.CreateElement, type, id);
  }

  __id: number;
  __attributes: Record<string, string> = {};
  __snapshot_def: Snapshot;

  private __parent: BackgroundSnapshotInstance | null = null;
  private __firstChild: BackgroundSnapshotInstance | null = null;
  private __lastChild: BackgroundSnapshotInstance | null = null;
  private __previousSibling: BackgroundSnapshotInstance | null = null;
  private __nextSibling: BackgroundSnapshotInstance | null = null;
  private __removed_from_tree?: boolean;

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

  // This will be called in `lazy`/`Suspense`.
  appendChild(child: BackgroundSnapshotInstance): void {
    return this.insertBefore(child);
  }

  insertBefore(
    node: BackgroundSnapshotInstance,
    beforeNode?: BackgroundSnapshotInstance,
  ): void {
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
    node.__removed_from_tree = true;

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

    globalBackgroundSnapshotInstancesToRemove.push(node.__id);
  }

  tearDown(): void {
    traverseSnapshotInstance(this, v => {
      v.__parent = null;
      v.__previousSibling = null;
      v.__nextSibling = null;
      backgroundSnapshotInstanceManager.values.delete(v.__id);
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

  setAttribute(key: string, value: string): void {
    if (__PROFILE__) {
      profileStart('ReactLynx::BSI::setAttribute');
    }
    this.__attributes[key] = value;

    __globalSnapshotPatch?.push(
      SnapshotOperation.SetAttribute,
      this.__id,
      key,
      typeof value === 'function' ? '' : value,
    );
    if (__PROFILE__) {
      profileEnd();
    }
  }
}

export function hydrate(
  before: SerializedSnapshotInstance,
  after: BackgroundSnapshotInstance,
): SnapshotPatch {
  initGlobalSnapshotPatch();

  const helper = (
    before: SerializedSnapshotInstance,
    after: BackgroundSnapshotInstance,
  ) => {
    hydrationMap.set(after.__id, before.id);
    backgroundSnapshotInstanceManager.updateId(after.__id, before.id);
    const keys = new Set([
      ...Object.keys(after.__attributes),
      ...Object.keys(before.attributes ?? {}),
    ]);
    for (const key of keys) {
      const value = after.__attributes[key];
      const old: unknown = before.attributes![key];
      if (typeof value === 'function') {
        // no need to handle for bindtap functions
      } else if (!isDirectOrDeepEqual(value, old)) {
        __globalSnapshotPatch!.push(
          SnapshotOperation.SetAttribute,
          after.__id,
          key,
          value,
        );
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

function reconstructInstanceTree(afters: BackgroundSnapshotInstance[], parentId: number, targetId?: number): void {
  for (const child of afters) {
    const id = child.__id;
    __globalSnapshotPatch?.push(SnapshotOperation.CreateElement, child.type, id);
    const attributes = child.__attributes;
    if (attributes) {
      for (const key in attributes) {
        child.setAttribute(key, attributes[key]!);
      }
    }
    reconstructInstanceTree(child.childNodes, id);
    __globalSnapshotPatch?.push(SnapshotOperation.InsertBefore, parentId, id, targetId);
  }
}
