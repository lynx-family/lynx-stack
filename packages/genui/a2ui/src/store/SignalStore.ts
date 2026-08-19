// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { batch, signal } from '@lynx-js/react-signals';
import type { Signal } from '@lynx-js/react-signals';

import {
  flattenJsonPointerValue,
  getJsonPointerParent,
  removeNestedValue,
  setNestedValue,
} from './jsonPointer.js';
import type { MessageProcessor } from './MessageProcessor.js';

/**
 * Path-keyed store of ReactLynx signals backing a surface's data model.
 */
export class SignalStore {
  private signals = new Map<string, Signal<unknown>>();

  getSignal(path: string, initialValue?: unknown): Signal<unknown> {
    let s = this.signals.get(path);
    if (!s) {
      s = signal(initialValue);
      this.signals.set(path, s);
    }
    return s;
  }

  update(path: string, value: unknown): void {
    const s = this.signals.get(path);
    if (!s) {
      this.signals.set(path, signal(value));
      return;
    }
    if (s.value !== value) {
      s.value = value;
    }
  }

  updateBatch(updates: { path: string; value: unknown }[]): void {
    batch(() => {
      for (const { path, value } of updates) {
        this.update(path, value);
      }
    });
  }

  /**
   * Delete a JSON-pointer path while keeping already-issued Signal objects
   * alive. Descendant bindings become `undefined`, and any stored ancestor
   * object snapshots are updated so bindings to a parent observe the removal.
   */
  delete(path: string): void {
    this.mutatePath(path, false, undefined);
  }

  /**
   * Replace a JSON-pointer path and synchronize any already-issued ancestor
   * object snapshots. Descendant signals are cleared by the replacement; the
   * caller may then seed new descendants from the replacement value.
   */
  replace(path: string, value: unknown): void {
    this.mutatePath(path, true, value);
  }

  private mutatePath(
    path: string,
    hasReplacement: boolean,
    replacement: unknown,
  ): void {
    const normalizedPath = path === '' ? '/' : path;
    const descendantPrefix = normalizedPath === '/'
      ? '/'
      : `${normalizedPath}/`;
    const parent = hasReplacement
      ? null
      : getJsonPointerParent(normalizedPath);
    const parentValue = parent ? this.signals.get(parent.path)?.value : null;
    const reindexed = parent && Array.isArray(parentValue)
      ? removeNestedValue(parentValue, [parent.segment])
      : null;

    batch(() => {
      for (const [signalPath, current] of this.signals) {
        if (
          normalizedPath === '/'
          || signalPath === normalizedPath
          || signalPath.startsWith(descendantPrefix)
        ) {
          const nextValue = signalPath === normalizedPath && hasReplacement
            ? replacement
            : undefined;
          if (!Object.is(current.value, nextValue)) current.value = nextValue;
          continue;
        }

        const ancestorPrefix = signalPath === '/' ? '/' : `${signalPath}/`;
        if (!normalizedPath.startsWith(ancestorPrefix)) continue;
        const relative = normalizedPath.slice(ancestorPrefix.length);
        if (!relative) continue;
        if (hasReplacement) {
          current.value = setNestedValue(
            current.value,
            relative.split('/'),
            replacement,
          );
        } else {
          const removed = removeNestedValue(
            current.value,
            relative.split('/'),
          );
          if (removed.changed) current.value = removed.value;
        }
      }

      if (parent && reindexed?.changed) {
        const reindexedPrefix = parent.path === '/'
          ? '/'
          : `${parent.path}/`;
        for (const [signalPath, current] of this.signals) {
          if (
            (signalPath === parent.path
              || signalPath.startsWith(reindexedPrefix))
            && current.value !== undefined
          ) {
            current.value = undefined;
          }
        }

        const updates: Array<{ path: string; value: unknown }> = [];
        flattenJsonPointerValue(reindexed.value, parent.path, updates);
        for (const update of updates) this.update(update.path, update.value);
      }
    });
  }
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
