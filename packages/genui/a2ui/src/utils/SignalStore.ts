// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { type Signal, batch, signal } from '@preact/signals';

export class SignalStore {
  private signals = new Map<string, Signal<unknown>>();

  getSignal(path: string, initialValue: unknown = ''): Signal<unknown> {
    if (!this.signals.has(path)) {
      this.signals.set(path, signal(initialValue));
    }
    const s = this.signals.get(path)!;
    if (initialValue && !s.value) {
      s.value = initialValue;
    }
    return s;
  }

  update(path: string, value: unknown): void {
    const s = this.getSignal(path);
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
