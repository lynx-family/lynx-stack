// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

class GlobalEventEmitter {
  listeners: Record<string, Function[]> = {};
  addListener(eventName: string, listener: Function): void {
    this.listeners[eventName] ??= [];
    this.listeners[eventName].push(listener);
  }
  removeListener(eventName: string, listener: Function): void {
    if (!this.listeners[eventName]) {
      return;
    }
    this.listeners[eventName] = this.listeners[eventName].filter((l) => l !== listener);
  }
  emit(eventName: string, args: any[]): void {
    if (!this.listeners[eventName]) {
      return;
    }
    this.listeners[eventName].forEach((listener) => args ? listener(...args) : listener());
  }
  clear(): void {
    this.listeners = {};
  }
  removeAllListeners(eventName?: string): void {
    if (eventName) {
      delete this.listeners[eventName];
    } else {
      this.clear();
    }
  }
  trigger(eventName: string, params: string | Record<any, any>): void {
    this.emit(eventName, [params]);
  }
  toggle(eventName: string, ...data: unknown[]): void {
    this.emit(eventName, data);
  }
}

const jsModules: {
  readonly GlobalEventEmitter: GlobalEventEmitter;
} = {
  GlobalEventEmitter: new GlobalEventEmitter(),
} as const;

export function getJSModule<T extends keyof typeof jsModules>(moduleName: T): typeof jsModules[T] {
  return jsModules[moduleName];
}
