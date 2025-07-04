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
  emit(eventName: string, ...args: any[]): void {
    if (!this.listeners[eventName]) {
      return;
    }
    this.listeners[eventName].forEach((listener) => listener(...args));
  }
  clear(): void {
    this.listeners = {};
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
