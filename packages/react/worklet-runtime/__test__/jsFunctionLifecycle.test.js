// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { beforeEach, describe, expect, it } from '@rstest/core';

import { JsFunctionLifecycleManager } from '../src/jsFunctionLifecycle';

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
});
