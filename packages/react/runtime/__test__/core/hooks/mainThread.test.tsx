// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeEach, afterEach, vi } from 'vitest';
import { globalEnvManager } from '../../snapshot/utils/envManager';
import { describe } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { beforeAll } from 'vitest';
import { replaceCommitHook } from '../../../src/snapshot/lifecycle/patch/commit';
import { elementTree } from '../../snapshot/utils/nativeMethod';
import { __root } from '../../../src/root';
import {
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
import { options, createContext } from 'preact';
import { HOOK } from '../../../src/shared/render-constants.js';

beforeAll(() => {
  replaceCommitHook();
});

beforeEach(() => {
  globalEnvManager.resetEnv();
});

afterEach(() => {
  elementTree.clear();
  vi.resetModules();
  vi.restoreAllMocks();
  globalThis.__GLOBAL_PROPS_MODE__ = 'reactive';
});

describe('mainThread hooks', () => {
  it('should get initialValue', () => {
    let setCount;
    options[HOOK] = vi.fn();
    options.useDebugValue = vi.fn();
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

      console.error = vi.fn();
      setCount(1);
      expect(console.error).toBeCalledWith('Cannot update state in main thread!');
    }
  });
});
