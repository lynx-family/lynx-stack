// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { EventEmitter as IEventEmitter } from '@lynx-js/types';

import type { Event } from '../types/runtimeProxy.js';

type Listener = (...args: unknown[]) => void;

interface ListenerEntry {
  listener: Listener;
  context: object | undefined;
}

type TriggerParams = Parameters<IEventEmitter['trigger']>[1];

const NATIVE_GLOBAL_EVENT = '__GlobalEvent';

function isContextProxy(value: unknown): value is {
  addEventListener(type: string, listener: (event: Event) => void): void;
} {
  const contextProxy = value as { addEventListener?: unknown };
  return !!value
    && typeof value === 'object'
    && typeof contextProxy.addEventListener === 'function';
}

class GlobalEventEmitter implements IEventEmitter {
  private readonly events: Map<string, ListenerEntry[]> = new Map();

  addListener(
    eventName: string,
    listener: Listener,
    context?: object,
  ): void {
    const listeners = this.events.get(eventName);
    if (listeners) {
      listeners.push({ listener, context });
      return;
    }
    this.events.set(eventName, [{ listener, context }]);
  }

  removeListener(eventName: string, listener: Listener): void {
    if (typeof listener !== 'function') {
      throw new Error('removeListener only takes instances of Function');
    }

    const listeners = this.events.get(eventName);
    if (!listeners) {
      return;
    }

    const index = listeners.findIndex((item) => item.listener === listener);
    if (index !== -1) {
      listeners.splice(index, 1);
      if (listeners.length === 0) {
        this.events.delete(eventName);
      }
    }
  }

  emit(eventName: string, data: unknown): void {
    if (!Array.isArray(data)) {
      return;
    }
    this.emitArgs(eventName, data);
  }

  removeAllListeners(eventName?: string): void {
    if (typeof eventName === 'string') {
      this.events.delete(eventName);
      return;
    }
    this.events.clear();
  }

  trigger(eventName: string, params: TriggerParams): void {
    if (!this.events.has(eventName)) {
      return;
    }
    const data = typeof params === 'string'
      ? JSON.parse(params) as unknown
      : params;
    this.emitArgs(eventName, [data]);
  }

  toggle(eventName: string, ...data: unknown[]): void {
    this.emit(eventName, data);
  }

  private emitArgs(eventName: string, args: unknown[]): void {
    const listeners = this.events.get(eventName);
    if (!listeners) {
      return;
    }
    listeners.forEach(({ listener, context }) => {
      if (typeof listener === 'function') {
        listener.apply(context ?? this, args);
      }
    });
  }
}

const emitterMap: WeakMap<object, GlobalEventEmitter> = new WeakMap();

function initGlobalEventEmitter(): GlobalEventEmitter {
  const lynxObject = lynx as unknown as object;
  const initializedEmitter = emitterMap.get(lynxObject);
  if (initializedEmitter) {
    return initializedEmitter;
  }

  const emitter = new GlobalEventEmitter();
  emitterMap.set(lynxObject, emitter);

  const originalGetJSModule: ((name: string) => unknown) | undefined = typeof lynx.getJSModule === 'function'
    ? lynx.getJSModule.bind(lynx)
    : undefined;
  lynx.getJSModule = ((name: string): unknown => {
    if (name === 'GlobalEventEmitter') {
      return emitter;
    }
    return originalGetJSModule?.(name);
  }) as typeof lynx.getJSModule;

  const nativeContext = typeof lynx.getNative === 'function'
    ? lynx.getNative()
    : undefined;
  if (isContextProxy(nativeContext)) {
    nativeContext.addEventListener(
      NATIVE_GLOBAL_EVENT,
      (event: Event): void => {
        const data = event.data;
        if (
          !Array.isArray(data)
          || data.length !== 2
          || typeof data[0] !== 'string'
          || !Array.isArray(data[1])
        ) {
          return;
        }
        // ContextProxy exposes Native arguments as a Lepus CArray, which
        // PrimJS's Function.prototype.apply cannot use as an argument list.
        emitter.emit(data[0], Array.from(data[1]));
      },
    );
  }

  return emitter;
}

export { GlobalEventEmitter, initGlobalEventEmitter };
