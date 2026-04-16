import { signal, Signal } from "@preact/signals";

export class SignalStore {
  signals: Map<string, Signal<any>>;

  constructor() {
    this.signals = new Map();
  }

  getSignal(path: string, initialValue?: any): Signal<any> {
    if (!this.signals.has(path)) {
      this.signals.set(path, signal(initialValue));
    }
    return this.signals.get(path)!;
  }

  update(path: string, value: any): void {
    if (!this.signals.has(path)) {
      this.signals.set(path, signal(value));
    } else {
      this.signals.get(path)!.value = value;
    }
  }

  updateBatch(updates: { path: string; value: any }[]): void {
    updates.forEach((u) => this.update(u.path, u.value));
  }
}
