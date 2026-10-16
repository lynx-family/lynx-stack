// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  GlobalEventEmitter,
  initGlobalEventEmitter,
} from '../../src/worklet-runtime/api/globalEventEmitter';
import { initApiEnv } from '../../src/worklet-runtime/api/lynxApi';

describe('GlobalEventEmitter', () => {
  it('dispatches toggle arguments in registration order with context', () => {
    const emitter = new GlobalEventEmitter();
    const context = {};
    const calls = [];

    emitter.addListener('event', function(...args) {
      calls.push([this, ...args]);
    }, context);
    emitter.addListener('event', function(...args) {
      calls.push([this, ...args]);
    });

    emitter.toggle('event', 1, 'two');

    expect(calls).toEqual([
      [context, 1, 'two'],
      [emitter, 1, 'two'],
    ]);
  });

  it('emits argument arrays and ignores invalid data or missing events', () => {
    const emitter = new GlobalEventEmitter();
    const listener = vi.fn();
    emitter.addListener('event', listener);

    emitter.emit('event', [2, 3]);
    emitter.emit('event', { value: 4 });
    emitter.emit('missing', [4]);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(2, 3);
  });

  it('ignores non-function listeners', () => {
    const emitter = new GlobalEventEmitter();
    emitter.addListener('event', undefined);

    expect(() => emitter.toggle('event')).not.toThrow();
  });

  it('triggers one parsed or object argument', () => {
    const emitter = new GlobalEventEmitter();
    const listener = vi.fn();
    emitter.addListener('event', listener);

    emitter.trigger('event', '{"value":1}');
    emitter.trigger('event', { value: 2 });

    expect(listener.mock.calls).toEqual([
      [{ value: 1 }],
      [{ value: 2 }],
    ]);
    expect(() => emitter.trigger('missing', 'invalid JSON')).not.toThrow();
  });

  it('removes only the first matching listener', () => {
    const emitter = new GlobalEventEmitter();
    const firstContext = {};
    const secondContext = {};
    const contexts = [];
    function listener() {
      contexts.push(this);
    }
    const otherListener = vi.fn();

    emitter.removeListener('missing', listener);
    emitter.addListener('event', listener, firstContext);
    emitter.addListener('event', listener, secondContext);
    emitter.removeListener('event', otherListener);
    emitter.removeListener('event', listener);
    emitter.toggle('event');

    expect(contexts).toEqual([secondContext]);
    emitter.removeListener('event', listener);
    expect(() => emitter.trigger('event', 'invalid JSON')).not.toThrow();
    expect(() => emitter.removeListener('event', undefined)).toThrow(
      'removeListener only takes instances of Function',
    );
  });

  it('removes listeners for one event or every event', () => {
    const emitter = new GlobalEventEmitter();
    const first = vi.fn();
    const second = vi.fn();
    emitter.addListener('first', first);
    emitter.addListener('second', second);

    emitter.removeAllListeners('first');
    emitter.toggle('first');
    emitter.toggle('second');
    emitter.removeAllListeners();
    emitter.toggle('second');

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe('initGlobalEventEmitter', () => {
  const globalNames = [
    'lynx',
    'SystemInfo',
    'setTimeout',
    'setInterval',
    'clearTimeout',
    'clearInterval',
    'requestAnimationFrame',
    'cancelAnimationFrame',
  ];
  let originalGlobalDescriptors;

  beforeEach(() => {
    originalGlobalDescriptors = new Map(
      globalNames.map((name) => [
        name,
        Object.getOwnPropertyDescriptor(globalThis, name),
      ]),
    );
  });

  afterEach(() => {
    for (const [name, descriptor] of originalGlobalDescriptors) {
      if (descriptor) {
        Object.defineProperty(globalThis, name, descriptor);
      } else {
        delete globalThis[name];
      }
    }
  });

  it('installs one module and Native global event listener per Lynx object', () => {
    let nativeListener;
    const nativeContext = {
      addEventListener: vi.fn((eventName, listener) => {
        expect(eventName).toBe('__GlobalEvent');
        nativeListener = listener;
      }),
    };
    const otherModule = {};
    const originalGetJSModule = vi.fn(() => otherModule);
    globalThis.lynx = {
      getJSModule: originalGetJSModule,
      getNative: vi.fn(() => nativeContext),
    };

    const emitter = initGlobalEventEmitter();
    expect(initGlobalEventEmitter()).toBe(emitter);
    expect(globalThis.lynx.getJSModule('GlobalEventEmitter')).toBe(emitter);
    expect(globalThis.lynx.getJSModule('OtherModule')).toBe(otherModule);
    expect(originalGetJSModule).toHaveBeenCalledWith('OtherModule');
    expect(nativeContext.addEventListener).toHaveBeenCalledTimes(1);

    const listener = vi.fn();
    emitter.addListener('native-event', listener);
    nativeListener({
      type: '__GlobalEvent',
      data: ['native-event', [{ value: 2 }]],
    });
    expect(listener).toHaveBeenCalledWith({ value: 2 });

    nativeListener({
      type: '__GlobalEvent',
      data: ['native-event', [1, { value: 3 }]],
    });
    expect(listener).toHaveBeenLastCalledWith(1, { value: 3 });

    nativeListener({ type: '__GlobalEvent', data: {} });
    nativeListener({ type: '__GlobalEvent', data: [1, []] });
    nativeListener({ type: '__GlobalEvent', data: ['native-event'] });
    nativeListener({
      type: '__GlobalEvent',
      data: ['native-event', { value: 4 }],
    });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('still installs the local module without ContextProxy APIs', () => {
    globalThis.lynx = {};

    const emitter = initGlobalEventEmitter();

    expect(globalThis.lynx.getJSModule('GlobalEventEmitter')).toBe(emitter);
    expect(globalThis.lynx.getJSModule('OtherModule')).toBeUndefined();
  });

  it('handles an unavailable Native ContextProxy', () => {
    globalThis.lynx = {
      getNative: () => undefined,
    };

    expect(initGlobalEventEmitter()).toBeInstanceOf(GlobalEventEmitter);
  });

  it('ignores Native return values without ContextProxy APIs', () => {
    globalThis.lynx = {
      getNative: () => ({}),
    };

    expect(initGlobalEventEmitter()).toBeInstanceOf(GlobalEventEmitter);
  });

  it('throws a version error from initApiEnv before Lynx sdk 4.2', () => {
    const nativeContext = {
      addEventListener: vi.fn(),
    };
    const otherModule = {};
    const originalGetJSModule = vi.fn(() => otherModule);
    globalThis.SystemInfo = {
      lynxSdkVersion: '4.1',
    };
    globalThis.lynx = {
      getJSModule: originalGetJSModule,
      requestAnimationFrame: vi.fn(),
      getNative: vi.fn(() => nativeContext),
    };

    initApiEnv();

    expect(() => globalThis.lynx.getJSModule('GlobalEventEmitter')).toThrow(
      'GlobalEventEmitter in main thread script requires Lynx sdk version 4.2',
    );
    expect(globalThis.lynx.getJSModule('OtherModule')).toBe(otherModule);
    expect(originalGetJSModule).toHaveBeenCalledWith('OtherModule');
    expect(nativeContext.addEventListener).not.toHaveBeenCalled();
  });

  it('installs from initApiEnv after Lynx sdk 4.1', () => {
    const nativeContext = {
      addEventListener: vi.fn(),
    };
    globalThis.SystemInfo = {
      lynxSdkVersion: '4.2',
    };
    globalThis.lynx = {
      requestAnimationFrame: vi.fn(),
      getNative: vi.fn(() => nativeContext),
    };

    initApiEnv();

    expect(globalThis.lynx.getJSModule('GlobalEventEmitter')).toBeInstanceOf(
      GlobalEventEmitter,
    );
    expect(nativeContext.addEventListener).toHaveBeenCalledWith(
      '__GlobalEvent',
      expect.any(Function),
    );
  });
});
