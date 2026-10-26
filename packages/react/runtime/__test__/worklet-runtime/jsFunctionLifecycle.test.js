// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { JsFunctionLifecycleManager } from '../../src/worklet-runtime/jsFunctionLifecycle';

let events = [];
beforeEach(() => {
  events = [];
  const context = {
    dispatchEvent: (x) => events.push(x),
  };
  globalThis.lynx = {
    getJSContext: () => context,
  };
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

  it('does not release a new runtime execution when retired finalizers run', () => {
    const previous = new JsFunctionLifecycleManager();
    previous.addRef(3, {});
    previous.removeRef(3);
    previous.dispose();
    const current = new JsFunctionLifecycleManager();
    current.addRef(3, {});
    previous.fire();
    expect(events).toEqual([]);
    expect(current.execIdRefCount.get(3)).toBe(1);
  });
});
