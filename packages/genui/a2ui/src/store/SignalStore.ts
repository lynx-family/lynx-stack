// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { batch, signal } from '@lynx-js/react-signals';
import type { Signal } from '@lynx-js/react-signals';

import type { MessageProcessor } from './MessageProcessor.js';
import {
  normalizePointer,
  readDataModel,
  replaceDataModel,
} from './protocol.js';
import { equalJsonValues } from './utils.js';

/**
 * Path-keyed store of ReactLynx signals backing a surface's data model.
 *
 * The data model is one immutable JSON value. A signal exists only for a path
 * something has read, and a write touches only the signals whose value it can
 * change: the written path, its ancestors, and its descendants.
 */
export class SignalStore {
  private dataModel: unknown = {};

  /** Current root JSON value, including local input edits. */
  getDataModel(): unknown {
    return this.dataModel;
  }

  private signals = new Map<string, Signal<unknown>>();

  getSignal(path: string, initialValue?: unknown): Signal<unknown> {
    let s = this.signals.get(path);
    if (!s) {
      // Created with its current value: main-thread first-screen rendering
      // must not depend on the intentionally inactive signal setter.
      const current = path.startsWith('/')
        ? readDataModel(this.dataModel, path)
        : undefined;
      s = signal(current === undefined ? initialValue : current);
      this.signals.set(path, s);
    }
    return s;
  }

  /**
   * Replace the value at `path`; `null` deletes it. Writing a value equal to
   * the current one changes nothing and notifies nobody.
   */
  update(path: string, value: unknown): void {
    const pointer = normalizePointer(path);
    const current = readDataModel(this.dataModel, pointer);
    if (
      value === null ? current === undefined : equalJsonValues(current, value)
    ) {
      return;
    }
    this.dataModel = replaceDataModel(this.dataModel, pointer, value);
    if (this.signals.size === 0) return;
    // Deleting an array element shifts its later siblings, so everything
    // under the parent may have moved.
    const subtree = value === null ? parentPointer(pointer) : pointer;
    const subtreePrefix = subtree === '/' ? '/' : `${subtree}/`;
    batch(() => {
      for (const [key, s] of this.signals) {
        if (
          key === subtree
          || key.startsWith(subtreePrefix)
          || isAncestor(key, pointer)
        ) {
          s.value = readDataModel(this.dataModel, key);
        }
      }
    });
  }

  updateBatch(updates: { path: string; value: unknown }[]): void {
    batch(() => {
      for (const { path, value } of updates) {
        this.update(path, value);
      }
    });
  }
}

function parentPointer(pointer: string): string {
  const index = pointer.lastIndexOf('/');
  return index <= 0 ? '/' : pointer.slice(0, index);
}

function isAncestor(candidate: string, pointer: string): boolean {
  return candidate === '/' || pointer.startsWith(`${candidate}/`);
}

/**
 * Resolve a data path for a surface and write the value into that surface's
 * signal store.
 *
 * @internal
 */
export function setInStore(
  processor: MessageProcessor,
  path: string,
  value: unknown,
  surfaceId: string,
  dataContextPath?: string,
): void {
  const surface = processor.getOrCreateSurface(surfaceId);
  const resolvedPath = processor.resolvePath(path, dataContextPath);
  surface.store.update(resolvedPath, value);
}
