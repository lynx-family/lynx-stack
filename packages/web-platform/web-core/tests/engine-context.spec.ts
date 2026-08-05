// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import './jsdom.js';
import { describe, expect, rstest, test } from '@rstest/core';
import { LynxEngineContext } from '../ts/common/LynxEngineContext.js';
import { createBackgroundLynx } from '../ts/client/background/background-apis/createBackgroundLynx.js';
import { registerDisposeHandler } from '../ts/client/background/background-apis/crossThreadHandlers/registerDisposeHandler.js';
import { createMainThreadGlobalAPIs } from '../ts/client/mainthread/createMainThreadGlobalAPIs.js';
import { createServerLynx } from '../ts/server/createServerLynx.js';
import type { LynxViewInstance } from '../ts/client/mainthread/LynxViewInstance.js';

describe('lynx.getEngine', () => {
  test('returns the page engine in the main-thread environment', () => {
    globalThis.cancelAnimationFrame ??= rstest.fn();
    const engineContext = new LynxEngineContext();
    const lynxViewInstance = {
      engineContext,
      globalprops: {},
      systemInfo: {},
      templateUrl: 'card.xml',
      backgroundThread: {
        jsContext: {},
        markTiming: rstest.fn(),
      },
      i18nManager: { _I18nResourceTranslation: rstest.fn() },
      lepusCodeUrls: new Map(),
      loadExternalBundle: rstest.fn(),
      mtsRealm: { loadScriptSync: rstest.fn() },
    } as unknown as LynxViewInstance;

    const { lynx } = createMainThreadGlobalAPIs(lynxViewInstance);

    expect(lynx.getEngine()).toBe(engineContext);
    expect(lynx.getEngine()).toBe(lynx.getEngine());
  });

  test('dispatches __DestroyLifetime once before main-thread resources are disposed', async () => {
    const { LynxViewInstance } = await import(
      '../ts/client/mainthread/LynxViewInstance.js'
    );
    const engineContext = new LynxEngineContext();
    const disposeOrder: string[] = [];
    const onDestroy = rstest.fn(() => disposeOrder.push('engine'));
    engineContext.addEventListener('__DestroyLifetime', onDestroy);

    const instance = {
      engineContext,
      boundingClientRectService: {
        dispose: () => disposeOrder.push('bounds'),
      },
      backgroundThread: {
        [Symbol.asyncDispose]: async () => disposeOrder.push('background'),
      },
      exposureServices: {
        dispose: () => disposeOrder.push('exposure'),
      },
      mtsWasmBinding: {
        disposeEventListeners: () => disposeOrder.push('events'),
        dispose: rstest.fn(),
      },
    };

    await LynxViewInstance.prototype[Symbol.asyncDispose].call(instance);
    engineContext.dispatchDestroyLifetime();

    expect(onDestroy).toHaveBeenCalledTimes(1);
    expect(disposeOrder).toEqual([
      'engine',
      'bounds',
      'background',
      'exposure',
      'events',
    ]);
  });

  test('dispatches __DestroyLifetime before destroying a background card', () => {
    let disposeHandler: (() => void) | undefined;
    const rpc = {
      registerHandler: rstest.fn((_endpoint, handler) => {
        disposeHandler = handler;
      }),
    };
    const engineContext = new LynxEngineContext();
    const disposeOrder: string[] = [];
    const onDestroy = rstest.fn(() => disposeOrder.push('engine'));
    engineContext.addEventListener('__DestroyLifetime', onDestroy);

    registerDisposeHandler(
      rpc as any,
      { id: 7 } as any,
      (id) => disposeOrder.push(`card:${id}`),
      (id) => disposeOrder.push(`runtime:${id}`),
      engineContext,
    );
    disposeHandler?.();
    engineContext.dispatchDestroyLifetime();

    expect(onDestroy).toHaveBeenCalledTimes(1);
    expect(disposeOrder).toEqual(['engine', 'runtime:7', 'card:7']);
  });

  test('exposes stable engine targets in background and SSR environments', () => {
    const rpc = {
      createCall: rstest.fn(() => rstest.fn()),
    };
    const backgroundLynx = createBackgroundLynx(
      {},
      {},
      {
        i18nResource: { data: {} },
      } as any,
      rpc as any,
    );
    const serverLynx = createServerLynx({}, {});

    expect(backgroundLynx.getEngine()).toBe(backgroundLynx.getEngine());
    expect(serverLynx.getEngine()).toBe(serverLynx.getEngine());
  });
});
