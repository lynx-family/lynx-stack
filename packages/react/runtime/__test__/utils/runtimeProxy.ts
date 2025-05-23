import { vi } from 'vitest';
import { globalEnvManager } from './envManager.ts';

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
