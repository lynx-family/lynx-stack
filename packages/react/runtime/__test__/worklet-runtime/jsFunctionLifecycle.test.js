// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { onDestroy } from '@lynx-js/lynx-runtime/mts';

import { JsFunctionLifecycleManager } from '../../src/worklet-runtime/jsFunctionLifecycle';

let events = [];
beforeEach(() => {
  events = [];
  const context = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: (x) => {
      if (x.type === 'Lynx.Worklet.releaseBackgroundWorkletCtx') events.push(x);
    },
  };
  vi.stubGlobal('lynx', { getJSContext: () => context });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('jsFunctionLifecycle', () => {
  it('should add', () => {
    const manager = new JsFunctionLifecycleManager();
    manager.addRef(3, {});
    manager.fire();
    expect(events[0]).toMatchInlineSnapshot(`
      {
        "data": [],
        "type": "Lynx.Worklet.releaseBackgroundWorkletCtx",
      }
    `);
  });

  it('should add and remove', () => {
    const manager = new JsFunctionLifecycleManager();
    manager.addRef(3, {});
    manager.removeRef(3);
    manager.fire();
    expect(events[0]).toMatchInlineSnapshot(`
      {
        "data": [
          3,
        ],
        "type": "Lynx.Worklet.releaseBackgroundWorkletCtx",
      }
    `);
  });

  it('should work when addRef() multiple times', () => {
    const manager = new JsFunctionLifecycleManager();
    manager.addRef(3, {});
    manager.addRef(3, {});
    manager.removeRef(3);
    manager.fire();
    expect(events[0]).toMatchInlineSnapshot(`
      {
        "data": [],
        "type": "Lynx.Worklet.releaseBackgroundWorkletCtx",
      }
    `);

    events = [];
    manager.removeRef(3);
    manager.fire();
    expect(events[0]).toMatchInlineSnapshot(`
      {
        "data": [
          3,
        ],
        "type": "Lynx.Worklet.releaseBackgroundWorkletCtx",
      }
    `);
  });

  it.each(['native', 'web'])('drops queued GC releases when the %s MTS host is destroyed', async platform => {
    const listeners = new Map();
    const proxy = {
      addEventListener: (type, listener) => listeners.set(type, listener),
      removeEventListener: type => listeners.delete(type),
    };
    let finalize;
    vi.stubGlobal(
      'FinalizationRegistry',
      class {
        constructor(callback) {
          finalize = callback;
        }
        register() {}
      },
    );
    vi.stubGlobal('SystemInfo', { platform });
    const jsContext = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: event => {
        if (event.type === 'Lynx.Worklet.releaseBackgroundWorkletCtx') events.push(event);
      },
    };
    vi.stubGlobal('lynx', {
      getJSContext: () => jsContext,
      ...(platform === 'web' ? { getEngine: () => proxy } : { getNative: () => proxy }),
    });
    const manager = new JsFunctionLifecycleManager();
    manager.addRef(3, {});
    manager.addRef(4, {});
    finalize(3);
    expect(manager.willFire).toBe(true);
    onDestroy(() => finalize(4));

    listeners.get('__DestroyLifetime')();

    expect(manager.execIdRefCount.size).toBe(0);
    expect(manager.execIdSetToFire.size).toBe(0);
    expect(manager.willFire).toBe(false);
    await Promise.resolve();
    expect(events).toEqual([]);

    expect(() => {
      finalize(4);
      manager.addRef(5, {});
      manager.fire();
    }).not.toThrow();
    await Promise.resolve();
    expect(manager.execIdRefCount.size).toBe(0);
    expect(manager.execIdSetToFire.size).toBe(0);
    expect(manager.willFire).toBe(false);
    expect(events).toEqual([]);
  });

  it('supports a lightweight Web host without a destruction proxy', () => {
    vi.stubGlobal('SystemInfo', { platform: 'web' });
    const manager = new JsFunctionLifecycleManager();
    manager.addRef(3, {});
    expect(() => manager.fire()).not.toThrow();
    expect(events).toHaveLength(1);
  });

  it('clears pending release state while propagating host send failures', () => {
    const failure = new Error('peer dispatch failed');
    const context = lynx.getJSContext();
    const manager = new JsFunctionLifecycleManager();
    context.dispatchEvent = () => {
      throw failure;
    };
    manager.execIdSetToFire.add(3);
    manager.willFire = true;

    expect(() => manager.fire()).toThrow(failure);
    expect(manager.execIdSetToFire.size).toBe(0);
    expect(manager.willFire).toBe(false);
  });

  it('should skip duplicated addRef() for the same object', () => {
    const manager = new JsFunctionLifecycleManager();
    const target = {};
    manager.addRef(3, target);
    manager.addRef(3, target);
    manager.removeRef(3);
    manager.fire();
    expect(events[0]).toMatchInlineSnapshot(`
      {
        "data": [
          3,
        ],
        "type": "Lynx.Worklet.releaseBackgroundWorkletCtx",
      }
    `);
  });
  it('leaves failed registrations retryable', () => {
    const manager = new JsFunctionLifecycleManager();
    const target = {};
    const error = new TypeError('target must be an object');
    const register = vi.spyOn(manager.registry, 'register').mockImplementationOnce(() => {
      throw error;
    });
    expect(() => manager.addRef(3, target)).toThrow(error);
    expect(manager.execIdRefCount.size).toBe(0);
    expect(manager.retainedObjects.has(target)).toBe(false);
    manager.addRef(3, target);
    expect(register).toHaveBeenCalledTimes(2);
    expect(manager.execIdRefCount.get(3)).toBe(1);
  });

  it('does not release a new runtime execution or retain onDestroy listeners when retired', async () => {
    const listeners = new Map();
    const proxy = {
      addEventListener: (type, listener) => listeners.set(type, listener),
      removeEventListener: type => listeners.delete(type),
    };
    const context = lynx.getJSContext();
    vi.stubGlobal('lynx', {
      getJSContext: () => context,
      getNative: () => proxy,
    });

    const previous = new JsFunctionLifecycleManager();
    previous.addRef(3, {});
    previous.removeRef(3);
    expect(previous.willFire).toBe(true);
    previous.dispose();
    expect(previous.execIdRefCount.size).toBe(0);
    expect(previous.execIdSetToFire.size).toBe(0);
    expect(previous.willFire).toBe(false);

    const retiredDispose = vi.spyOn(previous, 'dispose');
    const current = new JsFunctionLifecycleManager();
    current.addRef(3, {});
    await Promise.resolve();
    previous.fire();
    expect(events).toEqual([]);
    expect(current.execIdRefCount.get(3)).toBe(1);

    listeners.get('__DestroyLifetime')();
    expect(retiredDispose).not.toHaveBeenCalled();
    expect(current.execIdRefCount.size).toBe(0);
  });
});
