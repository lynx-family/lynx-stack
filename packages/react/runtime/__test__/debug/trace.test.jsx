// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Component, options, render } from 'preact';
import { useState } from '../../src/index';
import { initProfileHook } from '../../src/debug/profile';
import { __root } from '../../src/root';
import { globalEnvManager } from '../utils/envManager';
import { elementTree, waitSchedule } from '../utils/nativeMethod';
import { NEXT_VALUE, VALUE, COMPONENT } from '../../src/renderToOpcodes/constants';

describe('Trace', () => {
  let originalDiffed;

  beforeEach(() => {
    globalEnvManager.resetEnv();
    // Enable background mode where profiling hooks are active
    globalEnvManager.switchToBackground();

    // Mock performance API if not already mocked by globals.js
    if (!lynx.performance) {
      lynx.performance = {
        profileStart: vi.fn(),
        profileEnd: vi.fn(),
        profileMark: vi.fn(),
        profileFlowId: vi.fn(() => 666),
        isProfileRecording: vi.fn(() => true),
      };
    }

    // Capture original options.diffed
    originalDiffed = options.diffed;

    // Initialize profile hook for every test
    initProfileHook();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Restore options.diffed to prevent hook stacking
    options.diffed = originalDiffed;
  });

  it('should trace useState updates in functional components', async () => {
    // Use the existing mock
    const profileMarkSpy = lynx.performance.profileMark;

    function App() {
      const [count, setCount] = useState(0);
      globalThis.triggerUpdate = () => setCount((c) => c + 1);

      return (
        <view>
          <text>{count}</text>
          <view
            onClick={globalThis.triggerUpdate}
            id='btn'
          />
        </view>
      );
    }

    // Initial render
    render(<App />, __root);
    await waitSchedule();

    // Verify initial render didn't trigger setState trace (it shouldn't)
    expect(profileMarkSpy).not.toHaveBeenCalledWith(
      'ReactLynx::hooks::setState',
      expect.anything(),
    );

    // Trigger update
    if (globalThis.triggerUpdate) {
      globalThis.triggerUpdate();
    } else {
      throw new Error('triggerUpdate not exposed');
    }

    // Wait for update to process (the setter interceptor runs synchronously during execution, but let's wait)
    await waitSchedule();

    // Verify trace
    // The setter interceptor calls profileMark synchronously when setCount is called.
    expect(profileMarkSpy).toHaveBeenCalledWith(
      'ReactLynx::hooks::setState',
      expect.objectContaining({
        flowId: expect.any(Number),
        args: expect.objectContaining({
          componentName: 'App',
          hookIdx: '0',
          currentValue: '0',
          nextValue: '1',
        }),
      }),
    );
  });

  it('should handle function values in useState', async () => {
    const profileMarkSpy = lynx.performance.profileMark;

    const funcA = () => 'A';
    const funcB = () => 'B';

    function App() {
      // Use function as initial state (lazy init), but result is a function?
      // No, to store a function, we must use `() => func`.
      const [func, setFunc] = useState(() => funcA);

      globalThis.updateFunc = () => setFunc(() => funcB);

      return <text>{func()}</text>;
    }

    render(<App />, __root);
    await waitSchedule();

    if (globalThis.updateFunc) {
      globalThis.updateFunc();
    }
    await waitSchedule();

    expect(profileMarkSpy).toHaveBeenCalledWith(
      'ReactLynx::hooks::setState',
      expect.objectContaining({
        args: expect.objectContaining({
          // The format function converts functions to string
          currentValue: expect.stringContaining('() =>'),
          nextValue: expect.stringContaining('() =>'),
        }),
      }),
    );
  });

  it('should handle unserializable values in useState', async () => {
    const profileMarkSpy = lynx.performance.profileMark;

    function App() {
      const [val, setVal] = useState({ id: 1 });

      globalThis.updateCircular = () => {
        const circular = { id: 2 };
        circular.self = circular;
        setVal(circular);
      };

      return <text>{val.id}</text>;
    }

    render(<App />, __root);
    await waitSchedule();

    if (globalThis.updateCircular) {
      globalThis.updateCircular();
    }
    await waitSchedule();

    expect(profileMarkSpy).toHaveBeenCalledWith(
      'ReactLynx::hooks::setState',
      expect.objectContaining({
        args: expect.objectContaining({
          nextValue: '"Unserializable"',
        }),
      }),
    );
  });

  it('should handle missing component instance', async () => {
    let capturedComponent;

    const profileWrapper = options.diffed;
    options.diffed = (vnode) => {
      if (vnode.__c && typeof vnode.type === 'function' && vnode.type.name === 'App') {
        capturedComponent = vnode.__c;
      }
      profileWrapper?.(vnode);
    };

    function App() {
      const [val, setVal] = useState(0);
      globalThis.updateMissing = () => setVal(1);
      return <text>{val}</text>;
    }
    render(<App />, __root);
    await waitSchedule();

    expect(capturedComponent).toBeDefined();

    if (capturedComponent && capturedComponent.__H && capturedComponent.__H.__) {
      // Sabotage: remove __c from the hook state
      capturedComponent.__H.__[0].__c = undefined;
    } else {
      throw new Error('Failed to access hook state for sabotage');
    }

    // Trigger update, expect Preact to crash (but our interceptor runs first)
    expect(() => {
      globalThis.updateMissing();
    }).toThrow();
  });

  it('should handle unknown component name', async () => {
    const profileMarkSpy = lynx.performance.profileMark;
    let capturedComponent;

    const profileWrapper = options.diffed;
    options.diffed = (vnode) => {
      if (vnode.__c && typeof vnode.type === 'function' && vnode.type.name === 'App') {
        capturedComponent = vnode.__c;
      }
      profileWrapper?.(vnode);
    };

    function App() {
      const [val, setVal] = useState(0);
      globalThis.updateUnknown = () => setVal(1);
      return <text>{val}</text>;
    }

    render(<App />, __root);
    await waitSchedule();

    expect(capturedComponent).toBeDefined();

    if (capturedComponent && capturedComponent.__v) {
      // Sabotage: set type to something not a function
      capturedComponent.__v.type = {};
    } else {
      throw new Error('Failed to access vnode for sabotage');
    }

    if (globalThis.updateUnknown) {
      globalThis.updateUnknown();
    }
    await waitSchedule();

    expect(profileMarkSpy).toHaveBeenCalledWith(
      'ReactLynx::hooks::setState',
      expect.objectContaining({
        args: expect.objectContaining({
          componentName: 'Unknown',
        }),
      }),
    );
  });

  it('should support manual vnode construction', () => {
    // Isolate from Preact internals by mocking the "old" hook
    options.diffed = vi.fn();
    initProfileHook();
    const profileHook = options.diffed;

    const vnode = {
      type: () => {},
      __c: {
        __H: {
          __: [
            {
              [VALUE]: [0, () => {}],
              [NEXT_VALUE]: 0,
            },
          ],
        },
      },
    };

    // Should not throw and should inspect the list
    expect(() => profileHook(vnode)).not.toThrow();

    // Check if property was defined
    const hookState = vnode.__c.__H.__[0];
    const desc = Object.getOwnPropertyDescriptor(hookState, NEXT_VALUE);
    expect(desc.set).toBeDefined();
  });

  it('should handle non-array hook values', () => {
    options.diffed = vi.fn();
    initProfileHook();
    const profileHook = options.diffed;

    const hookState = {
      [VALUE]: 'not-an-array',
      [NEXT_VALUE]: 'next',
      [COMPONENT]: { __v: { type: () => {} } },
    };

    const vnode = {
      type: () => {},
      __c: {
        __H: {
          __: [hookState],
        },
      },
    };

    profileHook(vnode);

    // Trigger setter
    hookState[NEXT_VALUE] = ['new-value']; // Must be array to enter the block where currentValue is resolved
    // The setter logic has: const currentValue = Array.isArray(...) ? ... : ...
    // Coverage should be hit.
  });

  it('should catch errors in hook iteration', () => {
    options.diffed = vi.fn();
    initProfileHook();
    const profileHook = options.diffed;

    const hookState = {
      [VALUE]: [0, null],
      [NEXT_VALUE]: 0,
    };
    // Make it impossible to define property (e.g. freeze or non-configurable)
    Object.defineProperty(hookState, NEXT_VALUE, {
      value: 0,
      configurable: false,
      writable: true,
    });

    const vnode = {
      type: () => {},
      __c: {
        __H: {
          __: [hookState],
        },
      },
    };

    // profileHook attempts `Object.defineProperty(hookState, NEXT_VALUE, ...)`
    // It should throw TypeError because it's non-configurable.
    // The loop wraps in try-catch.
    expect(() => profileHook(vnode)).not.toThrow();
  });
});
