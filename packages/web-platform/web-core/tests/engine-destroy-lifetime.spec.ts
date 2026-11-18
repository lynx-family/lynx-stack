// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import './jsdom.js';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  rstest,
  test,
} from '@rstest/core';
import { createMainThreadGlobalAPIs } from '../ts/client/mainthread/createMainThreadGlobalAPIs.js';
import { LynxViewInstance } from '../ts/client/mainthread/LynxViewInstance.js';
import type { LynxViewElement } from '../ts/client/mainthread/LynxView.js';
import type { JSRealm } from '../ts/types/index.js';
import { EngineMessageEventType } from '../ts/constants.js';

/**
 * Drive `LynxViewInstance`'s teardown path without standing up a real worker,
 * wasm context or template bundle. Only the collaborators that
 * `[Symbol.asyncDispose]` reaches are stubbed; the engine dispatch logic under
 * test is the real implementation.
 */
function createInstance() {
  const host = document.createElement('div') as unknown as LynxViewElement;
  return new LynxViewInstance(
    host,
    {},
    {},
    'http://localhost/card.web.bundle',
    host.attachShadow({ mode: 'open' }),
    { globalWindow: globalThis } as JSRealm,
    false,
    undefined,
  );
}

describe('__DestroyLifetime on teardown', () => {
  let instance: LynxViewInstance;
  let disposeCalls: string[];

  beforeEach(() => {
    rstest.resetAllMocks();
    disposeCalls = [];

    instance = createInstance();
    const disposeBackground = instance.backgroundThread[Symbol.asyncDispose]
      .bind(instance.backgroundThread);
    instance.backgroundThread[Symbol.asyncDispose] = async () => {
      disposeCalls.push('backgroundThread');
      await disposeBackground();
    };
    Object.assign(instance, {
      boundingClientRectService: {
        dispose: () => disposeCalls.push('boundingClientRect'),
      },
      intersectionObserverService: {
        dispose: () => disposeCalls.push('intersectionObserver'),
      },
      exposureServices: { dispose: () => disposeCalls.push('exposure') },
      mtsWasmBinding: {
        disposeEventListeners: () => disposeCalls.push('mtsEventListeners'),
        dispose: () => disposeCalls.push('mtsBinding'),
      },
    });
  });

  afterEach(() => {
    rstest.restoreAllMocks();
    rstest.unstubAllGlobals();
  });

  test('delivers distinct Native view IDs and preserves the Engine payload', async () => {
    rstest.stubGlobal('cancelAnimationFrame', rstest.fn());
    const second = createInstance();
    const nativePayloads: unknown[] = [];
    const enginePayloads: unknown[] = [];
    const type = EngineMessageEventType.DestroyLifetime;
    for (const view of [instance, second]) {
      const { lynx } = createMainThreadGlobalAPIs(view);
      lynx.getNative().addEventListener(
        type,
        ({ data }) => nativePayloads.push(data),
      );
      lynx.getEngine().addEventListener(
        type,
        ({ data }) => enginePayloads.push(data),
      );
      await view[Symbol.asyncDispose]();
      expect(lynx.getNative().hasEventListener(type)).toBe(false);
    }

    expect(nativePayloads).toEqual([expect.any(Number), expect.any(Number)]);
    expect(nativePayloads[1]).toBeGreaterThan(nativePayloads[0] as number);
    expect(enginePayloads).toEqual([undefined, undefined]);
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

  test('a throwing Native listener does not skip the Engine notification or teardown', async () => {
    // Otherwise a buggy card would leak the worker and DOM listeners.
    const consoleError = rstest.spyOn(console, 'error').mockImplementation(
      () => {},
    );
    const engineCleanup = rstest.fn();
    instance.engineContext.addEventListener(
      EngineMessageEventType.DestroyLifetime,
      engineCleanup,
    );
    instance.nativeContext.addEventListener(
      EngineMessageEventType.DestroyLifetime,
      () => {
        throw new Error('card cleanup blew up');
      },
    );

    await expect(instance[Symbol.asyncDispose]()).resolves.toBeUndefined();

    expect(disposeCalls).toContain('backgroundThread');
    expect(disposeCalls).toContain('exposure');
    expect(disposeCalls).toContain('mtsEventListeners');
    expect(engineCleanup).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
