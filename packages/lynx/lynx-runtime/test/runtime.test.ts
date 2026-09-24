// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  destroyLifetimeEventName,
  initializeBackgroundThread,
  initializeMainThread,
  renderPageEventName,
  updatePageEventName,
} from '../src/index.js';
import type {
  LynxRuntimeHost,
  RuntimeEvent,
  RuntimeEventTarget,
} from '../src/index.js';

class TestEventTarget implements RuntimeEventTarget {
  readonly #listeners = new Map<
    string,
    Set<(event: RuntimeEvent) => void>
  >();
  peer: TestEventTarget = this;

  addEventListener(
    type: string,
    listener: (event: RuntimeEvent) => void,
  ): void {
    const listeners = this.#listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.#listeners.set(type, listeners);
  }

  dispatchEvent(event: RuntimeEvent): void {
    this.peer.emit(event);
  }

  emit(event: RuntimeEvent): void {
    for (const listener of this.#listeners.get(event.type) ?? []) {
      listener(event);
    }
  }

  listenerCount(type: string): number {
    return this.#listeners.get(type)?.size ?? 0;
  }

  removeEventListener(
    type: string,
    listener: (event: RuntimeEvent) => void,
  ): void {
    this.#listeners.get(type)?.delete(listener);
  }
}

function createCrossThreadTargets(): [TestEventTarget, TestEventTarget] {
  const main = new TestEventTarget();
  const background = new TestEventTarget();
  main.peer = background;
  background.peer = main;
  return [main, background];
}

function createHost(
  engine: RuntimeEventTarget,
  coreContext: RuntimeEventTarget,
  jsContext: RuntimeEventTarget,
): LynxRuntimeHost {
  return {
    getCoreContext: () => coreContext,
    getEngine: () => engine,
    getJSContext: () => jsContext,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete (globalThis as { processData?: unknown }).processData;
});

describe('lynx runtime', () => {
  test('initializes lifecycle handling and both communication directions', () => {
    interface ToBackground {
      Increment: { amount: number };
    }
    interface ToMain {
      CounterUpdated: number;
    }
    interface MainLocal {
      Refresh: string;
    }
    interface BackgroundLocal {
      Persist: boolean;
    }

    const engine = new TestEventTarget();
    const mainLocal = new TestEventTarget();
    const backgroundLocal = new TestEventTarget();
    const [mainBridge, backgroundBridge] = createCrossThreadTargets();
    const onRenderPage = vi.fn();
    const onUpdatePage = vi.fn();
    const onMainDestroy = vi.fn();
    const onBackgroundDestroy = vi.fn();

    vi.stubGlobal(
      'lynx',
      createHost(engine, mainLocal, mainBridge),
    );
    const mainRuntime = initializeMainThread<
      ToBackground,
      ToMain,
      MainLocal,
      { count: number }
    >({
      onDestroy: onMainDestroy,
      onRenderPage,
      onUpdatePage,
    });
    const processData = (
      globalThis as {
        processData?: (data: unknown) => unknown;
      }
    ).processData;
    expect(processData).toBeTypeOf('function');
    expect(processData?.({ count: 1 })).toEqual({ count: 1 });

    vi.stubGlobal(
      'lynx',
      createHost(new TestEventTarget(), backgroundBridge, backgroundLocal),
    );
    const backgroundRuntime = initializeBackgroundThread<
      ToMain,
      ToBackground,
      BackgroundLocal
    >({
      onDestroy: onBackgroundDestroy,
    });

    const onIncrement = vi.fn();
    const onCounterUpdated = vi.fn();
    const onMainRefresh = vi.fn();
    const onBackgroundPersist = vi.fn();
    backgroundRuntime.onMainThreadEvent('Increment', onIncrement);
    mainRuntime.onBackgroundEvent('CounterUpdated', onCounterUpdated);
    mainRuntime.onLocalEvent('Refresh', onMainRefresh);
    backgroundRuntime.onLocalEvent('Persist', onBackgroundPersist);

    mainRuntime.dispatchToBackground('Increment', { amount: 2 });
    backgroundRuntime.dispatchToMainThread('CounterUpdated', 2);
    mainRuntime.dispatchLocally('Refresh', 'now');
    backgroundRuntime.dispatchLocally('Persist', true);

    expect(onIncrement).toHaveBeenCalledWith({ amount: 2 });
    expect(onCounterUpdated).toHaveBeenCalledWith(2);
    expect(onMainRefresh).toHaveBeenCalledWith('now');
    expect(onBackgroundPersist).toHaveBeenCalledWith(true);

    engine.dispatchEvent({
      type: renderPageEventName,
      data: [{ count: 2 }, { pipeline: 'initial' }],
    });
    engine.dispatchEvent({
      type: updatePageEventName,
      data: [{ count: 3 }, { pipeline: 'update' }],
    });

    expect(onRenderPage).toHaveBeenCalledWith(
      { count: 2 },
      { pipeline: 'initial' },
    );
    expect(onUpdatePage).toHaveBeenCalledWith(
      { count: 3 },
      { pipeline: 'update' },
    );
    engine.dispatchEvent({
      type: destroyLifetimeEventName,
      data: undefined,
    });

    expect(onMainDestroy).toHaveBeenCalledOnce();
    expect(onBackgroundDestroy).toHaveBeenCalledOnce();
    expect(mainBridge.listenerCount('CounterUpdated')).toBe(0);
    expect(backgroundBridge.listenerCount('Increment')).toBe(0);
    expect(engine.listenerCount(renderPageEventName)).toBe(0);
    expect(
      (globalThis as { processData?: unknown }).processData,
    ).toBe(processData);
    expect(() => {
      mainRuntime.dispatchToBackground('Increment', { amount: 1 });
    }).toThrow('destroyed');
    expect(() => {
      backgroundRuntime.dispatchToMainThread('CounterUpdated', 1);
    }).toThrow('destroyed');
  });

  test('returns an idempotent event unsubscribe function', () => {
    interface Events {
      Ping: number;
    }

    const engine = new TestEventTarget();
    const mainBridge = new TestEventTarget();
    vi.stubGlobal(
      'lynx',
      createHost(engine, new TestEventTarget(), mainBridge),
    );
    const processData = vi.fn();
    vi.stubGlobal('processData', processData);
    const runtime = initializeMainThread<Events, Events>({
      onRenderPage: () => undefined,
    });
    expect(
      (globalThis as { processData?: unknown }).processData,
    ).toBe(processData);
    const handler = vi.fn();
    const unsubscribe = runtime.onBackgroundEvent('Ping', handler);

    mainBridge.emit({ type: 'Ping', data: 1 });
    unsubscribe();
    unsubscribe();
    mainBridge.emit({ type: 'Ping', data: 2 });

    expect(handler).toHaveBeenCalledOnce();
    runtime.destroy();
  });

  test('finishes cleanup before rethrowing a destroy error', () => {
    interface Events {
      Ping: number;
    }

    const engine = new TestEventTarget();
    const [mainBridge, backgroundBridge] = createCrossThreadTargets();
    vi.stubGlobal(
      'lynx',
      createHost(engine, new TestEventTarget(), mainBridge),
    );
    const onMainDestroy = vi.fn();
    const mainRuntime = initializeMainThread<Events, Events>({
      onDestroy: onMainDestroy,
      onRenderPage: () => undefined,
    });
    mainRuntime.onBackgroundEvent('Ping', () => undefined);

    vi.stubGlobal(
      'lynx',
      createHost(
        new TestEventTarget(),
        backgroundBridge,
        new TestEventTarget(),
      ),
    );
    const backgroundRuntime = initializeBackgroundThread<Events, Events>({
      onDestroy: () => {
        throw new Error('background cleanup failed');
      },
    });
    backgroundRuntime.onMainThreadEvent('Ping', () => undefined);

    expect(() => {
      engine.dispatchEvent({
        type: destroyLifetimeEventName,
        data: undefined,
      });
    }).toThrow('background cleanup failed');

    expect(onMainDestroy).toHaveBeenCalledOnce();
    expect(mainBridge.listenerCount('Ping')).toBe(0);
    expect(backgroundBridge.listenerCount('Ping')).toBe(0);
    expect(engine.listenerCount(renderPageEventName)).toBe(0);
  });
});
