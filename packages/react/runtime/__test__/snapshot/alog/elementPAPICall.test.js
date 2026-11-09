import { describe, it, vi } from 'vitest';
import { initElementPAPICallAlog } from '../../../src/snapshot/alog/elementPAPICall';
import { globalEnvManager } from '../utils/envManager';
import { expect } from 'vitest';

describe('ElementPAPICall Alog', () => {
  it('should log ElementPAPICall as ALog', () => {
    globalEnvManager.switchToMainThread();
    console.alog = vi.fn();
    initElementPAPICallAlog();

    const page = __CreatePage('0', 0);
    __SetCSSId([page], 0);
    const text0 = __CreateText(0);
    const rawText0 = __CreateRawText('2', text0.$$uiSign);
    __AppendElement(text0, rawText0);
    __AppendElement(page, text0);
    __AddDataset(text0, 'testid', 'count-value');
    __OnLifecycleEvent(['rLynxFirstScreen', { 'root': '{}', 'firstScreenEventIdSwap': {} }]);

    expect(console.alog.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "[ReactLynxDebug] FiberElement API call #1: __CreatePage("0", 0) => page#0",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #2: __SetCSSId(array, 0)",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #3: __CreateText(0) => text#1",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #4: __CreateRawText("2", 1) => raw-text#2",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #5: __AppendElement(text#1, raw-text#2)",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #6: __AppendElement(page#0, text#1)",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #7: __AddDataset(text#1, "testid", "count-value")",
        ],
        [
          "[ReactLynxDebug] FiberElement API call #8: __OnLifecycleEvent(array)",
        ],
      ]
    `);
  });
  it('passes opaque values through and bounds previews', () => {
    const native = vi.fn(value => value);
    const target = { __SetAttribute: native };
    initElementPAPICallAlog(target);
    const cyclic = [];
    cyclic.push(cyclic);
    const toJSON = vi.fn(() => {
      throw new Error('unexpected serialization');
    });
    const value = { toJSON };
    const long = 'x'.repeat(1000);
    const alog = vi.spyOn(console, 'alog').mockImplementation(() => {});
    try {
      expect(target.__SetAttribute(value, 1n, cyclic, true, null, long, 'extra')).toBe(value);
      expect(native).toHaveBeenCalledTimes(1);
      expect(native.mock.calls[0][0]).toBe(value);
      expect(native.mock.calls[0][1]).toBe(1n);
      expect(native.mock.calls[0][2]).toBe(cyclic);
      expect(toJSON).not.toHaveBeenCalled();
      expect(alog).toHaveBeenCalledWith(
        `[ReactLynxDebug] FiberElement API call #1: __SetAttribute(object, bigint, array, true, null, "${
          'x'.repeat(80)
        }…", … (+1)) => object`,
      );
    } finally {
      alog.mockRestore();
    }
  });

  it('skips log work when both sinks are disabled', () => {
    const originalProfile = globalThis.__PROFILE__;
    const originalAlog = console.alog;
    globalThis.__PROFILE__ = false;
    console.alog = undefined;
    try {
      const handle = {};
      const getTag = vi.fn();
      const getId = vi.fn();
      const target = { __CreateView: () => handle, __GetTag: getTag, __GetElementUniqueID: getId };
      initElementPAPICallAlog(target);
      expect(target.__CreateView()).toBe(handle);
      expect(getTag).not.toHaveBeenCalled();
      expect(getId).not.toHaveBeenCalled();
    } finally {
      console.alog = originalAlog;
      globalThis.__PROFILE__ = originalProfile;
    }
  });

  it.each(['start', 'end', 'alog', 'tag'])('preserves the native call when %s fails', (failure) => {
    const originalProfile = globalThis.__PROFILE__;
    globalThis.__PROFILE__ = true;
    const diagnosticError = new Error('diagnostic failed');
    const nativeError = new Error('native failed');
    const throwDiagnosticError = () => {
      throw diagnosticError;
    };
    const start = lynx.performance.profileStart;
    const end = lynx.performance.profileEnd;
    const alog = vi.spyOn(console, 'alog');
    const handle = {};
    const native = vi.fn(() => handle);
    const target = {
      __CreateView: native,
      __GetTag: failure === 'tag' ? throwDiagnosticError : () => 'view',
      __GetElementUniqueID: () => 42,
    };
    const failSink = () => {
      if (failure === 'start') start.mockImplementationOnce(throwDiagnosticError);
      if (failure === 'end') end.mockImplementationOnce(throwDiagnosticError);
      if (failure === 'alog') alog.mockImplementationOnce(throwDiagnosticError);
    };
    try {
      initElementPAPICallAlog(target);
      start.mockClear();
      end.mockClear();
      failSink();
      expect(target.__CreateView()).toBe(handle);
      expect(start).toHaveBeenCalledTimes(1);
      expect(end).toHaveBeenCalledTimes(failure === 'start' ? 0 : 1);
      native.mockImplementationOnce(() => {
        throw nativeError;
      });
      if (failure === 'end') end.mockImplementationOnce(throwDiagnosticError);
      expect(() => target.__CreateView()).toThrow(nativeError);
      expect(native).toHaveBeenCalledTimes(2);
    } finally {
      start.mockClear();
      end.mockClear();
      alog.mockRestore();
      globalThis.__PROFILE__ = originalProfile;
    }
  });
});
