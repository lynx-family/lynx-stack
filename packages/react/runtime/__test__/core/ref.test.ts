import { afterEach, describe, expect, it, vi } from 'vitest';

import { OrdinaryRefEffectQueue, SelectorRefProxy, applyOrdinaryRef, normalizeRefValue } from '../../src/core/ref.js';
import type { RefProxyForwardedMethods } from '../../src/core/ref.js';

class TestSelectorRefProxy extends SelectorRefProxy<TestSelectorRefProxy> {
  constructor(
    private readonly selectorValue: string,
    private readonly schedule: (task: () => void) => void,
  ) {
    super();

    return this.createProxy();
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
    const reportError = stubReportError();

    applyOrdinaryRef(ref, 'node');
    expect(ref.current).toBe('node');

    applyOrdinaryRef(ref, null);
    expect(ref.current).toBeNull();
    expect(reportError).not.toHaveBeenCalled();
  });

  it('runs function cleanup instead of calling null when cleanup exists', () => {
    const cleanup = vi.fn();
    const ref = vi.fn(() => cleanup);
    const reportError = stubReportError();

    applyOrdinaryRef(ref, 'node');
    expect(ref._unmount).toBe(cleanup);
    ref.mockClear();

    applyOrdinaryRef(ref, null);

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(ref).not.toHaveBeenCalled();
    expect(ref._unmount).toBeUndefined();
    expect(reportError).not.toHaveBeenCalled();
  });

  it('calls function refs with null when no cleanup exists', () => {
    const ref = vi.fn();
    const reportError = stubReportError();

    applyOrdinaryRef(ref, 'node');
    ref.mockClear();

    applyOrdinaryRef(ref, null);

    expect(ref).toHaveBeenCalledWith(null);
    expect(reportError).not.toHaveBeenCalled();
  });

  it('ignores non-function cleanup return values', () => {
    const refMock = vi.fn(() => null);
    const ref = refMock as unknown as ((value: string | null) => void) & {
      _unmount?: (() => void) | void;
    };
    const reportError = stubReportError();

    applyOrdinaryRef(ref, 'node');
    refMock.mockClear();

    applyOrdinaryRef(ref, null);

    expect(refMock).toHaveBeenCalledWith(null);
    expect(ref._unmount).toBeUndefined();
    expect(reportError).not.toHaveBeenCalled();
  });

  it('reports ref errors without throwing', () => {
    const error = new Error('ref failed');
    const ref = vi.fn(() => {
      throw error;
    });
    const reportError = stubReportError();

    applyOrdinaryRef(ref, 'node');

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

    queue.queue(unchangedRef, unchangedRef, 'ignored');
    queue.queue(oldRef, newRef, 'node');
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
});
