// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export type LynxTestEventListener = (...args: unknown[]) => void;

export class LynxTestEventEmitter {
  readonly listeners = new Map<string, LynxTestEventListener[]>();

  addListener(eventName: string, listener: LynxTestEventListener): void {
    const listeners = this.listeners.get(eventName);
    if (listeners) {
      listeners.push(listener);
      return;
    }
    this.listeners.set(eventName, [listener]);
  }

  removeListener(eventName: string, listener: LynxTestEventListener): void {
    const listeners = this.listeners.get(eventName);
    if (!listeners) {
      return;
    }
    const index = listeners.indexOf(listener);
    if (index === -1) {
      return;
    }
    listeners.splice(index, 1);
    if (listeners.length === 0) {
      this.listeners.delete(eventName);
    }
  }

  removeAllListeners(eventName?: string): void {
    if (eventName) {
      this.listeners.delete(eventName);
      return;
    }
    this.clear();
  }

  emit(eventName: string, args?: unknown[]): void {
    for (const listener of [...(this.listeners.get(eventName) ?? [])]) {
      listener(...(args ?? []));
    }
  }

  trigger(eventName: string, params: string | Record<PropertyKey, unknown>): void {
    this.emit(eventName, [params]);
  }

  toggle(eventName: string, ...data: unknown[]): void {
    this.emit(eventName, data);
  }

  clear(): void {
    this.listeners.clear();
  }

  listenerCount(eventName: string): number {
    return this.listeners.get(eventName)?.length ?? 0;
  }
}
