// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import './jsdom.js';
import { beforeEach, describe, expect, rstest, test } from '@rstest/core';
import { LynxViewInstance } from '../ts/client/mainthread/LynxViewInstance.js';
import { LynxEngineContextImpl } from '../ts/client/mainthread/LynxEngineContext.js';
import { EngineMessageEventType } from '../ts/constants.js';

/**
 * Drive `LynxViewInstance`'s teardown path without standing up a real worker,
 * wasm context or template bundle. Only the collaborators that
 * `[Symbol.asyncDispose]` reaches are stubbed; the engine dispatch logic under
 * test is the real implementation.
 */
describe('__DestroyLifetime on teardown', () => {
  let instance: LynxViewInstance;
  let disposeCalls: string[];

  beforeEach(() => {
    rstest.resetAllMocks();
    disposeCalls = [];

    instance = Object.create(LynxViewInstance.prototype) as LynxViewInstance;
    // `engineContext` is a readonly class field, so install it the way the
    // real constructor would.
    Object.defineProperty(instance, 'engineContext', {
      value: new LynxEngineContextImpl(),
      writable: false,
      configurable: true,
    });
    Object.assign(instance, {
      boundingClientRectService: {
        dispose: () => disposeCalls.push('boundingClientRect'),
      },
      intersectionObserverService: {
        dispose: () => disposeCalls.push('intersectionObserver'),
      },
      backgroundThread: {
        [Symbol.asyncDispose]: async () => {
          disposeCalls.push('backgroundThread');
        },
      },
      exposureServices: { dispose: () => disposeCalls.push('exposure') },
      mtsWasmBinding: {
        disposeEventListeners: () => disposeCalls.push('mtsEventListeners'),
        dispose: () => disposeCalls.push('mtsBinding'),
      },
    });
  });

  test('dispatches __DestroyLifetime when the instance is disposed', async () => {
    const cleanup = rstest.fn();
    instance.engineContext.addEventListener(
      EngineMessageEventType.DestroyLifetime,
      cleanup,
    );

    await instance[Symbol.asyncDispose]();

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(
      (cleanup.mock.calls[0]![0] as unknown as { type: string }).type,
    ).toBe('__DestroyLifetime');
  });

  test('the card can still clean up element listeners during the event', async () => {
    // The card's cleanup must run while the element tree is still intact, so
    // __DestroyLifetime has to fire *before* the binding is torn down.
    instance.engineContext.addEventListener(
      EngineMessageEventType.DestroyLifetime,
      () => disposeCalls.push('cardCleanup'),
    );

    await instance[Symbol.asyncDispose]();

    expect(disposeCalls[0]).toBe('cardCleanup');
    expect(disposeCalls).toContain('mtsEventListeners');
    expect(disposeCalls.indexOf('cardCleanup')).toBeLessThan(
      disposeCalls.indexOf('mtsEventListeners'),
    );
  });

  test('listeners are dropped after disposal', async () => {
    const cleanup = rstest.fn();
    instance.engineContext.addEventListener(
      EngineMessageEventType.DestroyLifetime,
      cleanup,
    );

    await instance[Symbol.asyncDispose]();
    expect(cleanup).toHaveBeenCalledTimes(1);

    // the proxy must not retain card closures past teardown
    expect(
      instance.engineContext.hasEventListener(
        EngineMessageEventType.DestroyLifetime,
      ),
    ).toBe(false);
    instance.engineContext.dispatchEvent({
      type: EngineMessageEventType.DestroyLifetime,
      data: undefined,
    });
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  test('disposal completes even with no __DestroyLifetime listener', async () => {
    await expect(instance[Symbol.asyncDispose]()).resolves.toBeUndefined();
    expect(disposeCalls).toContain('backgroundThread');
    expect(disposeCalls).toContain('mtsEventListeners');
  });

  test('a throwing card cleanup does not abort teardown', async () => {
    // Otherwise a buggy card would leak the worker and DOM listeners.
    const consoleError = rstest.spyOn(console, 'error').mockImplementation(
      () => {},
    );
    instance.engineContext.addEventListener(
      EngineMessageEventType.DestroyLifetime,
      () => {
        throw new Error('card cleanup blew up');
      },
    );

    await expect(instance[Symbol.asyncDispose]()).resolves.toBeUndefined();

    expect(disposeCalls).toContain('backgroundThread');
    expect(disposeCalls).toContain('exposure');
    expect(disposeCalls).toContain('mtsEventListeners');
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
