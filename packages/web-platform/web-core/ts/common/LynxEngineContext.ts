// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  ContextCrossThreadEvent,
  LynxEventTarget,
} from '../types/index.js';

const destroyLifetimeEventName = '__DestroyLifetime';

export class LynxEngineContext implements LynxEventTarget {
  #destroyLifetimeDispatched = false;
  #listeners = new Map<string, Set<(event: Event) => void>>();

  dispatchEvent(event: ContextCrossThreadEvent): number {
    let defaultPrevented = false;
    let immediatePropagationStopped = false;
    const engineEvent = {
      type: event.type,
      data: event.data ?? {},
      get defaultPrevented() {
        return defaultPrevented;
      },
      preventDefault() {
        defaultPrevented = true;
      },
      stopImmediatePropagation() {
        immediatePropagationStopped = true;
      },
      stopPropagation() {},
    } as unknown as Event;
    for (const listener of [...this.#listeners.get(event.type) ?? []]) {
      listener.call(this, engineEvent);
      if (immediatePropagationStopped) break;
    }
    return defaultPrevented ? 1 : 0;
  }

  addEventListener(type: string, listener: (event: Event) => void): void {
    let listeners = this.#listeners.get(type);
    if (!listeners) {
      listeners = new Set();
      this.#listeners.set(type, listeners);
    }
    listeners.add(listener);
  }

  removeEventListener(type: string, listener: (event: Event) => void): void {
    const listeners = this.#listeners.get(type);
    listeners?.delete(listener);
    if (listeners?.size === 0) {
      this.#listeners.delete(type);
    }
  }

  dispatchDestroyLifetime(): void {
    if (this.#destroyLifetimeDispatched) return;
    this.#destroyLifetimeDispatched = true;
    this.dispatchEvent({
      type: destroyLifetimeEventName,
      data: undefined,
    });
  }
}
