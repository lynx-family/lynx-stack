// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { batch, signal } from '@preact/signals';
import type { Signal } from '@preact/signals';

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
