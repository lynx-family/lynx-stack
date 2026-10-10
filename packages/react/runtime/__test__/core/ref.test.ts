import { afterEach, describe, expect, it, vi } from 'vitest';

import { OrdinaryRefEffectQueue, SelectorRefProxy, applyOrdinaryRef, normalizeRefValue } from '../../src/core/ref.js';
import type { OrdinaryRefBinding, RefProxyForwardedMethods } from '../../src/core/ref.js';

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
    const owner = {};

    queue.queue(null, oldRef, owner, 0, 'old-node');
    queue.flush(token => `proxy:${token}`);
    calls.length = 0;

    queue.queue(unchangedRef, unchangedRef, {}, 0, 'ignored');
    queue.queue(oldRef, newRef, owner, 0, 'node');
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

  it('does not detach a reentrant attachment when an aborted ref adds a duplicate clear', () => {
    const queue = new OrdinaryRefEffectQueue<string, string>();
    const owner = {};
    const calls: string[] = [];
    const replacement = vi.fn((value: string | null) => {
      calls.push(`replacement:${value}`);
    });
    const cleanup = vi.fn(() => {
      calls.push('cleanup');
      queue.queue(null, replacement, owner, 0, 'replacement');
      queue.flush(token => token);
    });
    const mountedRef = vi.fn(() => cleanup);
    const abortedRef = vi.fn();

    queue.queue(null, mountedRef, owner, 0, 'mounted');
    queue.flush(token => token);
    queue.queue(mountedRef, abortedRef, owner, 0, 'aborted');
    queue.discardPendingAttachments();
    queue.queue(abortedRef, null, owner, 0, 'aborted');
    queue.flush(token => token);

    expect(calls).toEqual(['cleanup', 'replacement:replacement']);
    expect(abortedRef).not.toHaveBeenCalled();
    expect(cleanup).toHaveBeenCalledTimes(1);
    queue.queue(replacement, null, owner, 0, 'replacement');
    queue.flush(token => token);
    expect(calls).toEqual(['cleanup', 'replacement:replacement', 'replacement:null']);
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
});
