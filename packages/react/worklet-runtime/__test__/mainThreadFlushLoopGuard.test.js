// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Element, setShouldFlush } from '../src/api/element';
import { RunWorkletSource } from '../src/bindings/types';
import {
  mainThreadFlushLoopMark,
  mainThreadFlushLoopOnFlushMicrotask,
  mainThreadFlushLoopReport,
  mainThreadFlushLoopReset,
} from '../src/utils/mainThreadFlushLoopGuard';
import { getFromWorkletRefMap } from '../src/workletRef';
import { initWorklet } from '../src/workletRuntime';

describe('MainThread flush loop guard (worklet-runtime only)', () => {
  beforeEach(() => {
    globalThis.SystemInfo = {
      lynxSdkVersion: '2.16',
    };

    initWorklet();

    globalThis.__SetAttribute = vi.fn();
    globalThis.__AddInlineStyle = vi.fn();
    globalThis.__InvokeUIMethod = vi.fn();
    globalThis.__FlushElementTree = vi.fn();
    globalThis.__DEV__ = true;
  });

  afterEach(() => {
    delete globalThis.lynxWorkletImpl;

    setShouldFlush(true);
    mainThreadFlushLoopReset();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('throws with trace', async () => {
    vi.useFakeTimers();

    // Ensure a stable main-thread function exists.
    globalThis.registerWorklet('main-thread', '1', () => undefined);

    globalThis.__FlushElementTree.mockImplementation(() => {
      // Emit markers inside the loop so they survive the trace ring buffer.
      globalThis.runWorklet({ _wkltId: '1' }, []);
      getFromWorkletRefMap({ _wvid: -1 }).current;
      new Element('element-instance').setStyleProperty('color', 'red');
    });

    new Element('element-instance').setStyleProperty('color', 'blue');

    let thrown;
    try {
      await vi.runAllTimersAsync();
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeTruthy();
    const msg = String(thrown?.message ?? thrown);
    expect(msg).toContain('[ReactLynx][DEV]');
    expect(msg).toContain('MainThread flush loop detected');
    expect(msg).toContain('MainThreadFunction');
    expect(msg).toContain('MainThreadRef:get');
    expect(msg).toContain('element:setStyleProperty color');
    expect(msg).toContain('render');
    expect(msg.toLowerCase()).not.toContain('worklet');
  });

  it('returns stable error once tripped', () => {
    mainThreadFlushLoopReset();
    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = () => 0;

    let err;
    try {
      for (let i = 0; i < 6000; i++) {
        err = mainThreadFlushLoopOnFlushMicrotask() ?? err;
      }
      const err2 = mainThreadFlushLoopOnFlushMicrotask();
      expect(err2).toBe(err);
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }
  });

  it('compresses duplicate markers', () => {
    mainThreadFlushLoopReset();
    mainThreadFlushLoopMark('dup');
    mainThreadFlushLoopMark('dup');

    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = () => 0;
    let err;
    try {
      for (let i = 0; i < 6000; i++) {
        err = mainThreadFlushLoopOnFlushMicrotask() ?? err;
      }
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }
    expect(String(err?.message)).toContain('dup x2');
  });

  it('compresses duplicates before a change', () => {
    mainThreadFlushLoopReset();
    mainThreadFlushLoopMark('dup');
    mainThreadFlushLoopMark('dup');
    mainThreadFlushLoopMark('a');

    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = () => 0;
    let err;
    try {
      for (let i = 0; i < 6000; i++) {
        err = mainThreadFlushLoopOnFlushMicrotask() ?? err;
      }
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }

    expect(String(err?.message)).toContain('a <- dup x2');
  });

  it('compresses duplicates at the most recent side', () => {
    mainThreadFlushLoopReset();
    mainThreadFlushLoopMark('a');
    mainThreadFlushLoopMark('dup');
    mainThreadFlushLoopMark('dup');

    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = () => 0;
    let err;
    try {
      for (let i = 0; i < 6000; i++) {
        err = mainThreadFlushLoopOnFlushMicrotask() ?? err;
      }
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }

    expect(String(err?.message)).toContain('dup x2 <- a');
  });

  it('keeps only the last TRACE_LIMIT markers', () => {
    mainThreadFlushLoopReset();
    for (let i = 0; i < 1300; i++) {
      mainThreadFlushLoopMark(`m${i}`);
    }

    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = () => 0;
    let err;
    try {
      for (let i = 0; i < 1300; i++) {
        err = mainThreadFlushLoopOnFlushMicrotask() ?? err;
      }
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }

    const msg = String(err?.message);
    expect(msg).not.toContain('m0');
    expect(msg).toContain('m1299');
  });

  it('default reporter throws on macrotask', () => {
    let thrown;
    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (cb) => {
      try {
        cb();
      } catch (e) {
        thrown = e;
      }
      return 0;
    };

    try {
      mainThreadFlushLoopReport(new Error('boom'));
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }

    expect(String(thrown?.message)).toContain('boom');
  });

  it('formats non-duplicate markers in reverse order', () => {
    mainThreadFlushLoopReset();
    mainThreadFlushLoopMark('a');
    mainThreadFlushLoopMark('b');

    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = () => 0;

    let err;
    try {
      for (let i = 0; i < 6000; i++) {
        err = mainThreadFlushLoopOnFlushMicrotask() ?? err;
      }
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }

    expect(String(err?.message)).toContain('b <- a');
  });

  it('adds event marker when source is EVENT', () => {
    mainThreadFlushLoopReset();
    globalThis.registerWorklet('main-thread', 'evt', () => undefined);
    globalThis.runWorklet(
      { _wkltId: 'evt' },
      [{ type: 'uiappear', target: {}, currentTarget: {} }],
      { source: RunWorkletSource.EVENT },
    );

    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = () => 0;

    let err;
    try {
      for (let i = 0; i < 6000; i++) {
        err = mainThreadFlushLoopOnFlushMicrotask() ?? err;
      }
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }

    expect(String(err?.message)).toContain('event:uiappear');
  });
});
