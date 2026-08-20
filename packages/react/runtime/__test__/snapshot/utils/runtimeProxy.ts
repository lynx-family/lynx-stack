// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { vi } from 'vitest';

import { globalEnvManager } from './envManager.js';

const eventEmitters = {};

function getType(context: string, type: string) {
  return `${context}+${type}`;
}

function getCurrentContextName() {
  return __JS__ ? 'jsContext' : 'coreContext';
}

function switchContext() {
  if (__JS__) {
    globalEnvManager.switchToMainThread();
  } else {
    globalEnvManager.switchToBackground();
  }
}

class EventEmitter {
  name = '';
  listeners = {};
  _addEventListener = (type, listener) => {
    const realType = getType(getCurrentContextName(), type);
    if (this.listeners[realType]) {
      this.listeners[realType].push(listener);
    } else {
      this.listeners[realType] = [listener];
    }
  };
  _removeEventListener = (type, listener) => {
    const realType = getType(getCurrentContextName(), type);
    if (this.listeners[realType]) {
      this.listeners[realType] = this.listeners[realType].filter((l) => l !== listener);
    }
  };
  _dispatchEvent = (event) => {
    const currentContextName = getCurrentContextName();
    if (this.name == currentContextName) {
      throw new Error('EventEmitter: cannot emit event on the same context');
    }
    const context = eventEmitters[currentContextName];
    const realType = getType(this.name, event.type);
    switchContext();
    if (context.listeners[realType]) {
      context.listeners[realType].forEach((listener) => listener(event));
    }
    switchContext();
  };

  constructor(name: string) {
    eventEmitters[name] = this;
    this.name = name;
  }

  addEventListener = vi.fn(this._addEventListener);

  removeEventListener = vi.fn(this._removeEventListener);

  dispatchEvent = vi.fn(this._dispatchEvent);
}

const coreContext = new EventEmitter('coreContext');
const jsContext = new EventEmitter('jsContext');

globalThis.lynx.getCoreContext = vi.fn(() => coreContext);
globalThis.lynx.getJSContext = vi.fn(() => jsContext);

/**
 * Emulate the engine delivering a `CoreContext -> JSContext` message event,
 * the way `tasm_mediator.cc` / `bts_runtime.cc` do in production. Tests keep
 * calling `lynxCoreInject.tt.OnLifecycleEvent(...)` as their "the engine fired
 * this" entry point; the runtime now receives it through `getCoreContext()`.
 */
function emulateEngineEvent(type: string, data: unknown) {
  // Deliver synchronously on the caller's thread, matching how lynx-core
  // forwards the event today. Going through `dispatchEvent` would toggle the
  // thread globals and change the timing these tests were written against.
  const listeners = coreContext.listeners[getType('jsContext', type)];
  listeners?.forEach((listener: (event: { data: unknown }) => void) => {
    listener({ data });
  });
}

globalThis.lynxCoreInject.tt.OnLifecycleEvent = vi.fn((data) => {
  emulateEngineEvent('__OnLifecycleEvent', data);
});
globalThis.lynxCoreInject.tt.updateGlobalProps = vi.fn((data) => {
  emulateEngineEvent('__NotifyGlobalPropsUpdated', data);
});
