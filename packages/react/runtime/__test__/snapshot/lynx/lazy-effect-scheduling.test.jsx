// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { options, render } from 'preact';
import { createElement } from 'preact/compat';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { lazy, useEffect, useRef, useState } from '../../../src/index.js';
import { makeSyncThen } from '../../../src/core/lynx/lazy-bundle.js';
import { __root } from '../../../src/root.js';
import { globalEnvManager } from '../utils/envManager.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('synchronous lazy imports with cached Promise.resolve results', () => {
  test.each([undefined, null, true, false, 0, ''])(
    'keeps the shared promise for %j asynchronous',
    async (value) => {
      const resolve = Promise.resolve.bind(Promise);
      const shared = resolve(value);
      const originalThen = shared.then;
      // The Lynx Promise polyfill reuses fulfilled promises for these values.
      vi.spyOn(Promise, 'resolve').mockImplementation(result => result === value ? shared : resolve(result));

      const promise = makeSyncThen('exports').call(resolve('exports'), () => value);
      let lazyCallbackCalled = false;
      promise.then(result => {
        expect(result).toBe(value);
        lazyCallbackCalled = true;
      });
      expect(lazyCallbackCalled).toBe(true);
      expect(shared.then).toBe(originalThen);

      let ordinaryCallbackCalled = false;
      Promise.resolve(value).then(() => {
        ordinaryCallbackCalled = true;
      });
      expect(ordinaryCallbackCalled).toBe(false);
      await resolve();
      expect(ordinaryCallbackCalled).toBe(true);
    },
  );

  test('a cached lazy child mount effect can update its parent without re-entering', async () => {
    globalEnvManager.resetEnv();
    globalEnvManager.switchToBackground();
    const previousDebounce = options.debounceRendering;
    const previousRaf = options.requestAnimationFrame;
    const resolve = Promise.resolve.bind(Promise);
    const sharedUndefined = resolve();
    vi.spyOn(Promise, 'resolve').mockImplementation(value => value === undefined ? sharedUndefined : resolve(value));

    // This is Preact's fallback scheduler in Lynx runtimes without the global
    // queueMicrotask API. Its Promise.resolve must remain asynchronous.
    options.debounceRendering = callback => Promise.resolve().then(callback);
    let flushEffects;
    options.requestAnimationFrame = callback => {
      flushEffects = callback;
    };

    const calls = [];
    let parentValue;
    function Leaf({ notify }) {
      const count = useRef(0);
      useEffect(() => {
        count.current++;
        calls.push(['effect', count.current]);
        notify();
        return () => calls.push(['cleanup', count.current]);
      }, []);
      return null;
    }
    const exports = { default: Leaf };
    const cached = resolve(exports);
    cached.then = makeSyncThen(exports);
    const Remote = lazy(() => cached);
    function App() {
      const [value, setValue] = useState(0);
      parentValue = value;
      return createElement(Remote, { notify: () => setValue(v => v + 1) });
    }

    try {
      render(createElement(App), __root);
      flushEffects();
      expect(calls).toEqual([['effect', 1]]);
      expect(parentValue).toBe(0);
      await resolve();
      expect(parentValue).toBe(1);
      expect(calls).toEqual([['effect', 1]]);

      render(null, __root);
      flushEffects();
      expect(calls).toEqual([['effect', 1], ['cleanup', 1]]);
    } finally {
      render(null, __root);
      flushEffects?.();
      options.debounceRendering = previousDebounce;
      options.requestAnimationFrame = previousRaf;
    }
  });
});
