// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeEach, afterEach, rs } from '@rstest/core';
import { globalEnvManager } from '../../snapshot/utils/envManager';
import { describe } from '@rstest/core';
import { it } from '@rstest/core';
import { expect } from '@rstest/core';
import { beforeAll } from '@rstest/core';
import { replaceCommitHook } from '../../../src/snapshot/lifecycle/patch/commit';
import { elementTree } from '../../snapshot/utils/nativeMethod';
import { __root } from '../../../src/root';
import {
  installMainThreadHooks,
  useState,
  useMemo,
  useEffect,
  useLayoutEffect,
  useImperativeHandle,
  useRef,
  useCallback,
  useDebugValue,
  useId,
  useErrorBoundary,
  useContext,
} from '../../../src/core/hooks/mainThread';
import {
  action,
  batch,
  computed,
  createModel,
  effect,
  Signal,
  signal,
  untracked,
  useComputed,
  useModel,
  useSignal,
  useSignalEffect,
} from '@lynx-js/react-signals/lepus';
import { options, createContext } from 'preact';
import { DIFF, HOOK } from '../../../src/shared/render-constants.js';

beforeAll(() => {
  replaceCommitHook();
});

beforeEach(() => {
  globalEnvManager.resetEnv();
});

afterEach(() => {
  elementTree.clear();
  rs.resetModules();
  rs.restoreAllMocks();
  globalThis.__GLOBAL_PROPS_MODE__ = 'reactive';
});

describe('mainThread hooks', () => {
  it('should skip duplicate installation', () => {
    const diffHook = options[DIFF];

    installMainThreadHooks();

    expect(options[DIFF]).toBe(diffHook);
  });

  it('should get initialValue', () => {
    let setCount;
    options[HOOK] = rs.fn();
    options.useDebugValue = rs.fn();
    lynx.reportError = (e) => {
      console.error('Error boundary caught error', e);
    };
    const ThemeContext = createContext();
    const App = () => {
      return (
        <ThemeContext.Provider value='dark'>
          <Comp />
        </ThemeContext.Provider>
      );
    };
    const Comp = () => {
      const [count, _setCount] = useState(0);
      const [content] = useState(() => 'hello');
      const memoCount = useMemo(() => count, [count]);
      useEffect(() => {}, []);
      useLayoutEffect(() => {}, []);
      useImperativeHandle(null, () => ({}));
      const ref = useRef(null);
      const handleTap = useCallback(() => {
        setCount(count + 1);
      }, []);
      useDebugValue(count);
      useErrorBoundary(() => {});
      const id = useId();
      const contextValue = useContext(ThemeContext);
      setCount = _setCount;
      return (
        <>
          <text ref={ref} bindtap={handleTap}>{count}-{content}-{memoCount}-{contextValue}-{id}</text>
          <SubComp />
        </>
      );
    };

    const SubComp = () => {
      const id = useId();
      return <text>SubComp-{id}</text>;
    };

    // main thread render
    {
      __root.__jsx = <App />;
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <text
            event={
              {
                "bindEvent:tap": "-2:1:",
              }
            }
            react-ref--2-0={1}
          >
            <wrapper>
              <raw-text
                text={0}
              />
            </wrapper>
            <raw-text
              text="-"
            />
            <wrapper>
              <raw-text
                text="hello"
              />
            </wrapper>
            <raw-text
              text="-"
            />
            <wrapper>
              <raw-text
                text={0}
              />
            </wrapper>
            <raw-text
              text="-"
            />
            <wrapper>
              <raw-text
                text="dark"
              />
            </wrapper>
            <raw-text
              text="-"
            />
            <wrapper>
              <raw-text
                text="P0-0"
              />
            </wrapper>
          </text>
          <text>
            <raw-text
              text="SubComp-"
            />
            <wrapper>
              <raw-text
                text="P0-1"
              />
            </wrapper>
          </text>
        </page>
      `);

      expect(options[HOOK]).toBeCalledTimes(9);
      // useState
      expect(options[HOOK]).toHaveBeenNthCalledWith(1, expect.anything(), 0, 1);
      expect(options[HOOK]).toHaveBeenNthCalledWith(2, expect.anything(), 1, 1);
      // useMemo
      expect(options[HOOK]).toHaveBeenNthCalledWith(3, expect.anything(), 2, 7);
      // useRef
      expect(options[HOOK]).toHaveBeenNthCalledWith(4, expect.anything(), 3, 5);
      // useCallback
      expect(options[HOOK]).toHaveBeenNthCalledWith(5, expect.anything(), 4, 8);
      // useErrorBoundary
      expect(options[HOOK]).toHaveBeenNthCalledWith(6, expect.anything(), 5, 10);
      // useId
      expect(options[HOOK]).toHaveBeenNthCalledWith(7, expect.anything(), 6, 11);
      // useContext
      expect(options[HOOK]).toHaveBeenNthCalledWith(8, expect.anything(), 7, 9);
      // useDebugValue
      expect(options.useDebugValue).toBeCalledWith(0);
      // SubComp useId
      expect(options[HOOK]).toHaveBeenNthCalledWith(9, expect.anything(), 0, 11);

      console.error = rs.fn();
      setCount(1);
      expect(console.error).toBeCalledWith('Cannot update state in main thread!');
    }
  });

  it('should keep signals static and effects inactive', () => {
    const signalEffect = rs.fn();
    const subscriber = rs.fn();
    const error = rs.spyOn(console, 'error').mockImplementation(() => {});
    const count = signal(1, { name: 'count' });
    const doubled = computed(() => count.value * 2, { name: 'doubled' });
    const unsubscribe = count.subscribe(subscriber);
    const unsubscribeComputed = doubled.subscribe(subscriber);
    const dispose = effect(signalEffect);

    const batchResult = batch(() => {
      count.value = 2;
      return 'batch-result';
    });

    expect(batchResult).toBe('batch-result');
    expect(count.name).toBe('count');
    expect(count.value).toBe(1);
    expect(count.peek()).toBe(1);
    expect(count.valueOf()).toBe(1);
    expect(count.toString()).toBe('1');
    expect(count.toJSON()).toBe(1);
    expect(doubled.name).toBe('doubled');
    expect(doubled.value).toBe(2);
    expect(doubled.peek()).toBe(2);
    expect(doubled.valueOf()).toBe(2);
    expect(doubled.toString()).toBe('2');
    expect(doubled.toJSON()).toBe(2);
    expect(untracked(() => count.value)).toBe(1);
    expect(new Signal(5).value).toBe(5);
    expect(signal().value).toBeUndefined();
    expect(signalEffect).not.toHaveBeenCalled();
    expect(subscriber).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      'Cannot update signal in main thread!',
    );

    dispose();
    unsubscribe();
    unsubscribeComputed();

    let localSignal;
    let localComputed;
    let emptySignal;
    let localModel;
    const hookEffect = rs.fn();
    const increment = action((value: number) => value + 1);
    const Counter = createModel(() => ({ count: signal(7) }));

    function App() {
      localSignal = useSignal(3, { name: 'local' });
      localComputed = useComputed(() => localSignal.value * 2);
      emptySignal = useSignal();
      localModel = useModel(Counter);
      useSignalEffect(hookEffect);

      return <text>{localSignal.value}-{localComputed.value}</text>;
    }

    __root.__jsx = <App />;
    renderPage();

    expect(localSignal.value).toBe(3);
    expect(localComputed.value).toBe(6);
    expect(emptySignal.value).toBeUndefined();
    expect(localModel.count.value).toBe(7);
    expect(increment(1)).toBe(2);
    expect(hookEffect).not.toHaveBeenCalled();

    localSignal.value = 4;
    expect(localSignal.value).toBe(3);
  });
});
