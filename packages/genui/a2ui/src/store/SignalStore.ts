// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { batch, signal } from '@lynx-js/react-signals';
import type { Signal } from '@lynx-js/react-signals';

import type { MessageProcessor } from './MessageProcessor.js';
import { flattenDataModel, replaceDataModel } from './protocol.js';

/**
 * Path-keyed store of ReactLynx signals backing a surface's data model.
 */
export class SignalStore {
  private typed = false;
  private dataModel: unknown = {};

  /** Enable v1.0 typed JSON updates and subtree replacement semantics. */
  enableTypedDataModel(): void {
    this.typed = true;
  }

  /** Current root JSON value, including local input edits. */
  getDataModel(): unknown {
    return this.dataModel;
  }

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
    if (this.typed) {
      this.dataModel = replaceDataModel(this.dataModel, path, value);
      const values = flattenDataModel(this.dataModel);
      batch(() => {
        for (const [key, s] of this.signals) s.value = values.get(key);
        for (const [key, item] of values) {
          if (!this.signals.has(key)) this.signals.set(key, signal(item));
        }
      });
      return;
    }
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
