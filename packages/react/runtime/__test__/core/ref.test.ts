import { afterEach, describe, expect, it, vi } from 'vitest';

import { OrdinaryRefEffectQueue, SelectorRefProxy, applyOrdinaryRef, normalizeRefValue } from '../../src/core/ref.js';
import type { OrdinaryRefBinding, RefProxyForwardedMethods } from '../../src/core/ref.js';

class TestSelectorRefProxy extends SelectorRefProxy<TestSelectorRefProxy> {
  constructor(
    private readonly selectorValue: string,
    private readonly schedule: (task: () => void) => void,
    template?: string,
  ) {
    super();

    return this.createProxy(template);
  }

  protected createProxyTarget(): TestSelectorRefProxy {
    return new TestSelectorRefProxy(this.selectorValue, this.schedule);
  }

  protected runOrDelay(task: () => void): void {
    this.schedule(task);
  }

  get selector(): string {
    return this.selectorValue;
  }
}

interface TestSelectorRefProxy extends RefProxyForwardedMethods<TestSelectorRefProxy> {}

function stubReportError(): ReturnType<typeof vi.fn> {
  const reportError = vi.fn();
  vi.stubGlobal('lynx', { ...(globalThis.lynx ?? {}), reportError });
  return reportError;
}

describe('core/ref ordinary ref semantics', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes valid refs and empty refs', () => {
    const callback = vi.fn();
    const objectRef = { current: null };

    expect(normalizeRefValue(callback)).toBe(callback);
    expect(normalizeRefValue(objectRef)).toBe(objectRef);
    expect(normalizeRefValue(null)).toBeNull();
    expect(normalizeRefValue(undefined)).toBeUndefined();
  });

  it('rejects invalid refs with the ReactLynx ordinary ref error', () => {
    const error = 'Elements\' "ref" property should be a function, or an object created by createRef()';

    expect(() => normalizeRefValue(false)).toThrowError(error);
    expect(() => normalizeRefValue(1)).toThrowError(error);
    expect(() => normalizeRefValue('ref')).toThrowError(error);
    expect(() => normalizeRefValue({})).toThrowError(error);
  });

  it('assigns object refs', () => {
    const ref = { current: null as string | null };
    const binding: OrdinaryRefBinding = {};
    const reportError = stubReportError();

    applyOrdinaryRef(ref, 'node', binding);
    expect(ref.current).toBe('node');

    applyOrdinaryRef(ref, null, binding);
    expect(ref.current).toBeNull();
    expect(reportError).not.toHaveBeenCalled();
  });

  it('runs function cleanup instead of calling null when cleanup exists', () => {
    const binding: OrdinaryRefBinding = {};
    const cleanup = vi.fn();
    const ref = vi.fn(() => cleanup);
    const reportError = stubReportError();

    applyOrdinaryRef(ref, 'node', binding);
    expect(binding.cleanup).toBe(cleanup);
    ref.mockClear();

    applyOrdinaryRef(ref, null, binding);

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(ref).not.toHaveBeenCalled();
    expect(binding.cleanup).toBeUndefined();
    expect(reportError).not.toHaveBeenCalled();
  });

  it('calls function refs with null when no cleanup exists', () => {
    const binding: OrdinaryRefBinding = {};
    const ref = vi.fn();
    const reportError = stubReportError();

    applyOrdinaryRef(ref, 'node', binding);
    ref.mockClear();

    applyOrdinaryRef(ref, null, binding);

    expect(ref).toHaveBeenCalledWith(null);
    expect(reportError).not.toHaveBeenCalled();
  });

  it('ignores non-function cleanup return values', () => {
    const binding: OrdinaryRefBinding = {};
    const refMock = vi.fn(() => null);
    const ref = refMock as unknown as (value: string | null) => void;
    const reportError = stubReportError();

    applyOrdinaryRef(ref, 'node', binding);
    refMock.mockClear();

    applyOrdinaryRef(ref, null, binding);

    expect(refMock).toHaveBeenCalledWith(null);
    expect(binding.cleanup).toBeUndefined();
    expect(reportError).not.toHaveBeenCalled();
  });

  it('reports ref errors without throwing', () => {
    const error = new Error('ref failed');
    const ref = vi.fn(() => {
      throw error;
    });
    const reportError = stubReportError();

    applyOrdinaryRef(ref, 'node', {});

    expect(reportError).toHaveBeenCalledWith(error);
  });

  it('queues ordinary ref effects as detach before attach', () => {
    const queue = new OrdinaryRefEffectQueue<string, string>();
    const calls: Array<[label: string, value: string | null]> = [];
    const oldRef = vi.fn((value: string | null) => {
      calls.push(['old', value]);
    });
    const newRef = vi.fn((value: string | null) => {
      calls.push(['new', value]);
    });
    const unchangedRef = vi.fn();
    const reportError = stubReportError();

    queue.queue(unchangedRef, unchangedRef, {}, 0, 'ignored');
    queue.queue(oldRef, newRef, {}, 0, 'node');
    expect(queue.hasPending()).toBe(true);

    queue.flush(token => `proxy:${token}`);

    expect(calls).toEqual([
      ['old', null],
      ['new', 'proxy:node'],
    ]);
    expect(unchangedRef).not.toHaveBeenCalled();
    expect(queue.hasPending()).toBe(false);
    expect(reportError).not.toHaveBeenCalled();
  });

  it('keeps shared callback cleanup per owner and slot across token remapping', () => {
    const queue = new OrdinaryRefEffectQueue<string, string>();
    const ownerA = {};
    const ownerB = {};
    const cleanups = new Map<string, ReturnType<typeof vi.fn>>();
    const ref = vi.fn((value: string | null) => {
      const cleanup = vi.fn();
      cleanups.set(value!, cleanup);
      return cleanup;
    });

    queue.queue(null, ref, ownerA, 0, 'A:0');
    queue.queue(null, ref, ownerA, 1, 'A:1');
    queue.queue(null, ref, ownerB, 0, 'B:0');
    queue.flush(token => token);

    expect(ref).toHaveBeenCalledTimes(3);
    for (const cleanup of cleanups.values()) {
      expect(cleanup).not.toHaveBeenCalled();
    }

    queue.queue(ref, null, ownerA, 0, 'remapped-A:0');
    queue.flush(token => token);
    expect(cleanups.get('A:0')).toHaveBeenCalledTimes(1);
    expect(cleanups.get('A:1')).not.toHaveBeenCalled();
    expect(cleanups.get('B:0')).not.toHaveBeenCalled();

    queue.queue(ref, null, ownerA, 1, 'remapped-A:1');
    queue.queue(ref, null, ownerB, 0, 'remapped-B:0');
    queue.flush(token => token);
    for (const cleanup of cleanups.values()) {
      expect(cleanup).toHaveBeenCalledTimes(1);
    }
    expect(ref).toHaveBeenCalledTimes(3);
  });

  it('clears pending effects without dropping mounted binding cleanup', () => {
    const queue = new OrdinaryRefEffectQueue<string, string>();
    const owner = {};
    const cleanup = vi.fn();
    const ref = vi.fn(() => cleanup);
    const discardedRef = vi.fn();

    queue.queue(null, ref, owner, 0, 'node');
    queue.flush(token => token);
    queue.queue(ref, discardedRef, owner, 0, 'node');
    queue.clear();

    expect(queue.hasPending()).toBe(false);
    expect(cleanup).not.toHaveBeenCalled();
    queue.queue(ref, null, owner, 0, 'node');
    queue.flush(token => token);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(discardedRef).not.toHaveBeenCalled();
    expect(ref).toHaveBeenCalledTimes(1);
  });

  it('consumes throwing cleanup before reporting its error', () => {
    const error = new Error('cleanup failed');
    const cleanup = vi.fn(() => {
      throw error;
    });
    const ref = vi.fn(() => cleanup);
    const binding: OrdinaryRefBinding = {};
    const reportError = stubReportError();

    applyOrdinaryRef(ref, 'node', binding);
    applyOrdinaryRef(ref, null, binding);

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(binding.cleanup).toBeUndefined();
    expect(ref).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(error);
  });

  it('forwards NodesRef methods through backend-provided selector and scheduler', () => {
    const exec = vi.fn();
    const fields = vi.fn(() => ({ exec }));
    const select = vi.fn(() => ({ fields }));
    const createSelectorQuery = vi.fn(() => ({ select }));
    const originalLynx = globalThis.lynx;
    const tasks: (() => void)[] = [];
    vi.stubGlobal('lynx', { createSelectorQuery });

    try {
      new TestSelectorRefProxy('[ref=test]', task => tasks.push(task)).fields({ id: true }).exec();

      expect(exec).not.toHaveBeenCalled();
      expect(tasks).toHaveLength(1);

      tasks[0]!();

      expect(createSelectorQuery).toHaveBeenCalledTimes(1);
      expect(select).toHaveBeenCalledWith('[ref=test]');
      expect(fields).toHaveBeenCalledWith({ id: true });
      expect(exec).toHaveBeenCalledTimes(1);
    } finally {
      vi.stubGlobal('lynx', originalLynx);
    }
  });

  it('enriches NODE_NOT_FOUND and NO_UI_FOR_NODE on invoke while leaving fields/path and other codes untouched', () => {
    const originalLynx = globalThis.lynx;
    const originalDev = globalThis.__DEV__;
    let lastInvokeOptions: Record<string, unknown> | undefined;
    let lastFieldsCallback: unknown;
    let lastPathCallback: unknown;

    const exec = vi.fn();
    const invoke = vi.fn((options?: Record<string, unknown>) => {
      lastInvokeOptions = options;
      return { exec };
    });
    const fields = vi.fn((_fields: Record<string, unknown>, cb?: unknown) => {
      lastFieldsCallback = cb;
      return { exec };
    });
    const path = vi.fn((cb?: unknown) => {
      lastPathCallback = cb;
      return { exec };
    });
    const select = vi.fn(() => ({ invoke, fields, path }));
    vi.stubGlobal('lynx', { createSelectorQuery: () => ({ select }) });

    try {
      globalThis.__DEV__ = false;

      // 1. Omitted fail in production passes original options untouched; fields & path callbacks pass through untouched
      const rawOptions = { method: 'boundingClientRect' };
      const proxy = new TestSelectorRefProxy('[react-ref-30-0]', task => task(), '__snapshot_test_1');
      proxy.invoke(rawOptions).exec();
      expect(lastInvokeOptions).toBe(rawOptions);
      (proxy.invoke as unknown as () => TestSelectorRefProxy)().exec();
      expect(lastInvokeOptions).toBeUndefined();

      const rawFieldsCb = vi.fn();
      const rawPathCb = vi.fn();
      proxy.fields({ id: true }, rawFieldsCb).exec();
      proxy.path(rawPathCb).exec();
      expect(lastFieldsCallback).toBe(rawFieldsCb);
      expect(lastPathCallback).toBe(rawPathCb);

      // 2. invoke preserves `this === options` on fail, enriches code 2 & 6, leaves other results untouched
      let seenFailThis: unknown;
      const seenSuccess: unknown[] = [];
      const seenErrors: unknown[] = [];
      const invokeOptions = {
        method: 'boundingClientRect',
        success(data: unknown) {
          seenSuccess.push(data);
        },
        fail(this: unknown, err: unknown) {
          seenFailThis = this;
          seenErrors.push(err);
        },
      };
      proxy.invoke(invokeOptions).exec();
      (lastInvokeOptions!.success as (data: unknown) => void)({ width: 10 });
      expect(seenSuccess).toEqual([{ width: 10 }]);

      (lastInvokeOptions!.fail as (err: unknown) => void)({
        code: 2,
        data: 'no node found for selector \'[react-ref-30-0]\'',
        extra: 'kept',
      });
      expect(seenFailThis).toBe(invokeOptions);
      expect(seenErrors[0]).toEqual({
        code: 2,
        data:
          'no node found for selector \'[react-ref-30-0]\' [ReactLynx ref: invoke(boundingClientRect), __snapshot_test_1]',
        extra: 'kept',
      });

      const methodNotFound = { code: 3, data: 'method not found' };
      (lastInvokeOptions!.fail as (err: unknown) => void)(methodNotFound);
      expect(seenErrors[1]).toBe(methodNotFound);

      const nonStringData = { code: 2, data: 123 };
      (lastInvokeOptions!.fail as (err: unknown) => void)(nonStringData);
      expect(seenErrors[2]).toBe(nonStringData);

      (lastInvokeOptions!.fail as (err: unknown) => void)(null);
      expect(seenErrors[3]).toBeNull();

      // 3. NO_UI_FOR_NODE (6) without template
      const plainProxy = new TestSelectorRefProxy('[ref=12-2]', task => task());
      const failOnly = vi.fn();
      plainProxy.invoke({ method: 'scrollIntoView', fail: failOnly }).exec();
      (lastInvokeOptions!.fail as (err: unknown) => void)({
        code: 6,
        data: 'node \'[ref=12-2]\' does not have a LynxUI',
      });
      expect(failOnly).toHaveBeenCalledWith({
        code: 6,
        data: 'node \'[ref=12-2]\' does not have a LynxUI [ReactLynx ref: invoke(scrollIntoView)]',
      });
    } finally {
      globalThis.__DEV__ = originalDev;
      vi.stubGlobal('lynx', originalLynx);
    }
  });

  it('provides __DEV__ omitted-fail diagnostics and appends exec() caller stack in __DEV__ only', () => {
    const originalLynx = globalThis.lynx;
    const originalDev = globalThis.__DEV__;
    const queuedTasks: (() => void)[] = [];
    const invokeCallbacks: Array<(res: unknown) => void> = [];
    const reportError = vi.fn();
    const switches: { disableSelectorQueryWarningWhenFailed?: boolean } = {};
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const invoke = vi.fn((options: { fail: (res: unknown) => void }) => {
      invokeCallbacks.push(options.fail);
      return { exec: vi.fn() };
    });
    vi.stubGlobal('lynx', {
      createSelectorQuery: () => ({
        select: () => ({ invoke }),
      }),
      reportError,
    });

    try {
      globalThis.__DEV__ = true;
      const proxy = new TestSelectorRefProxy('[react-ref-10-0]', task => queuedTasks.push(task), '__snapshot_dev_1');

      // 1. Explicit fail in __DEV__ vs prod
      const results: string[] = [];
      const query = proxy.invoke({
        method: 'focus',
        fail: res => results.push(res.data),
      });

      function callExecBeforeHydration() {
        query.exec();
      }
      callExecBeforeHydration();

      queuedTasks.shift()!();
      invokeCallbacks.shift()!({
        code: 2,
        data: 'no node found for selector \'[react-ref-10-0]\'',
      });

      expect(results[0]).toContain(
        'no node found for selector \'[react-ref-10-0]\' [ReactLynx ref: invoke(focus), __snapshot_dev_1]',
      );
      expect(results[0]).toContain('ReactLynx ref exec() call stack');
      expect(results[0]).toContain('callExecBeforeHydration');

      globalThis.__DEV__ = false;
      query.exec();
      queuedTasks.shift()!();
      invokeCallbacks.shift()!({
        code: 2,
        data: 'no node found for selector \'[react-ref-10-0]\'',
      });

      expect(results[1]).toBe(
        'no node found for selector \'[react-ref-10-0]\' [ReactLynx ref: invoke(focus), __snapshot_dev_1]',
      );

      // 2. Omitted fail in __DEV__: code=2 enriched, code=3 still reported, code=0/null ignored, switch respected
      globalThis.__DEV__ = true;
      function callOmittedFailInDev() {
        proxy.invoke({ method: 'boundingClientRect' }).exec();
      }
      callOmittedFailInDev();
      queuedTasks.shift()!();
      const devFallbackFail = invokeCallbacks.shift()!;

      // null and code === 0 do not warn or report
      devFallbackFail(null);
      devFallbackFail({ code: 0, data: '' });
      expect(warnSpy).not.toHaveBeenCalled();
      expect(reportError).not.toHaveBeenCalled();

      // code === 2 (without _switches on lynx) warns & reports enriched diagnostic + stack
      devFallbackFail({
        code: 2,
        data: 'no node found for selector \'[react-ref-10-0]\'',
      });
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]![0]).toContain(
        '[ReactLynx ref: invoke(boundingClientRect), __snapshot_dev_1]',
      );
      expect(warnSpy.mock.calls[0]![0]).toContain('callOmittedFailInDev');
      expect(reportError).toHaveBeenCalledTimes(1);
      expect((reportError.mock.calls[0]![0] as Error).name).toBe('INVOKE_ERROR');

      // code === 3 (with _switches.disableSelectorQueryWarningWhenFailed = false) is still warned & reported
      (globalThis.lynx as unknown as { _switches?: typeof switches })._switches = switches;
      switches.disableSelectorQueryWarningWhenFailed = false;
      devFallbackFail({
        code: 3,
        data: 'method not found: boundingClientRect',
      });
      expect(warnSpy).toHaveBeenCalledTimes(2);
      expect(warnSpy.mock.calls[1]![0]).toContain('method not found: boundingClientRect');
      expect(warnSpy.mock.calls[1]![0]).not.toContain('[ReactLynx ref:');
      expect(reportError).toHaveBeenCalledTimes(2);

      // disableSelectorQueryWarningWhenFailed = true suppresses warning & reportError
      switches.disableSelectorQueryWarningWhenFailed = true;
      devFallbackFail({
        code: 2,
        data: 'no node found for selector \'[react-ref-10-0]\'',
      });
      expect(warnSpy).toHaveBeenCalledTimes(2);
      expect(reportError).toHaveBeenCalledTimes(2);
    } finally {
      warnSpy.mockRestore();
      globalThis.__DEV__ = originalDev;
      vi.stubGlobal('lynx', originalLynx);
    }
  });
});
