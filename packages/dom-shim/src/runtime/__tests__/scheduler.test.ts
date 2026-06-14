// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  _resetSchedulerForTesting,
  flush,
  isAutoFlushEnabled,
  scheduleFlush,
  setAutoFlush,
} from '../scheduler.ts';

describe('US-411 auto-flush microtask scheduler', () => {
  let flushSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    _resetSchedulerForTesting();
    flushSpy = vi.fn();
    (globalThis as Record<string, unknown>)['__FlushElementTree'] = flushSpy;
  });

  afterEach(() => {
    _resetSchedulerForTesting();
  });

  it('multiple scheduleFlush calls within one microtask coalesce to one flush', async () => {
    scheduleFlush();
    scheduleFlush();
    scheduleFlush();
    expect(flushSpy).not.toHaveBeenCalled();
    await new Promise<void>((r) => {
      queueMicrotask(r);
    });
    expect(flushSpy).toHaveBeenCalledTimes(1);
  });

  it('a scheduleFlush in a new microtask schedules again', async () => {
    scheduleFlush();
    await new Promise<void>((r) => {
      queueMicrotask(r);
    });
    expect(flushSpy).toHaveBeenCalledTimes(1);

    scheduleFlush();
    await new Promise<void>((r) => {
      queueMicrotask(r);
    });
    expect(flushSpy).toHaveBeenCalledTimes(2);
  });

  it('flush() invokes the engine synchronously regardless of auto setting', () => {
    setAutoFlush(false);
    flush();
    expect(flushSpy).toHaveBeenCalledTimes(1);
  });

  it('scheduleFlush is a no-op when auto-flush is disabled', async () => {
    setAutoFlush(false);
    scheduleFlush();
    scheduleFlush();
    await new Promise<void>((r) => {
      queueMicrotask(r);
    });
    expect(flushSpy).not.toHaveBeenCalled();
  });

  it('setAutoFlush toggles isAutoFlushEnabled', () => {
    expect(isAutoFlushEnabled()).toBe(true);
    setAutoFlush(false);
    expect(isAutoFlushEnabled()).toBe(false);
    setAutoFlush(true);
    expect(isAutoFlushEnabled()).toBe(true);
  });

  it('flush() swallows engine errors', () => {
    (globalThis as Record<string, unknown>)['__FlushElementTree'] = () => {
      throw new Error('engine refuses');
    };
    expect(() => flush()).not.toThrow();
  });
});
