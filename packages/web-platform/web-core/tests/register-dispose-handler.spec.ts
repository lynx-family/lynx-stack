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
import { registerDisposeHandler } from '../ts/client/background/background-apis/crossThreadHandlers/registerDisposeHandler.js';
import { disposeEndpoint } from '../ts/client/endpoints.js';
import type { NativeApp } from '../ts/types/index.js';
import type { Rpc } from '@lynx-js/web-worker-rpc';

/**
 * `registerDisposeHandler` is the background-thread side of `lynx-view`
 * teardown. It bridges to two lynx-core entry points:
 *
 * - `callDestroyLifetimeFun(id)` forwards to `tt.callDestroyLifetimeFun`, an
 *   *optional* hook that only the ReactLynx background runtime installs;
 * - `destroyCard(id)` is mandatory — it destroys the app and removes it from
 *   `nativeGlobal.multiApps`.
 *
 * Buildless (vanilla / Lynx XML markup) cards ship their own background script
 * and never install the ReactLynx hook, so lynx-core throws a `TypeError` for
 * them. These tests pin down that the optional hook cannot take the mandatory
 * teardown down with it.
 */
describe('registerDisposeHandler', () => {
  let handler: () => void;
  let rpc: Rpc;
  let nativeApp: NativeApp;
  let consoleError: ReturnType<typeof rstest.spyOn>;

  beforeEach(() => {
    handler = () => {
      throw new Error('dispose handler was never registered');
    };
    rpc = {
      registerHandler: (endpoint: { name: string }, fn: () => void) => {
        expect(endpoint.name).toBe(disposeEndpoint.name);
        handler = fn;
      },
    } as unknown as Rpc;
    nativeApp = { id: '0' } as unknown as NativeApp;
    // Spy rather than assign, so real error output is restored for other specs
    // that may share this worker.
    consoleError = rstest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  test('calls the lifetime hook before destroying the card', () => {
    const calls: string[] = [];
    registerDisposeHandler(
      rpc,
      nativeApp,
      (id) => calls.push(`destroyCard:${id}`),
      (id) => calls.push(`callDestroyLifetimeFun:${id}`),
    );

    handler();

    expect(calls).toStrictEqual([
      'callDestroyLifetimeFun:0',
      'destroyCard:0',
    ]);
    expect(consoleError).not.toHaveBeenCalled();
  });

  test('still destroys the card when the card has no lifetime hook', () => {
    const calls: string[] = [];
    registerDisposeHandler(
      rpc,
      nativeApp,
      (id) => calls.push(`destroyCard:${id}`),
      () => {
        // The shape lynx-core throws for a card that never ran ReactLynx's
        // `injectTt`, i.e. every Lynx XML markup card.
        throw new TypeError(
          'nativeGlobal.multiApps[id].callDestroyLifetimeFun is not a function',
        );
      },
    );

    expect(() => handler()).not.toThrow();

    expect(calls).toStrictEqual(['destroyCard:0']);
    // A card simply not having the optional hook is not an error worth logging.
    expect(consoleError).not.toHaveBeenCalled();
  });

  test('reports a failing lifetime callback but still destroys the card', () => {
    const calls: string[] = [];
    const failure = new Error('framework cleanup blew up');
    registerDisposeHandler(
      rpc,
      nativeApp,
      (id) => calls.push(`destroyCard:${id}`),
      () => {
        throw failure;
      },
    );

    expect(() => handler()).not.toThrow();

    expect(calls).toStrictEqual(['destroyCard:0']);
    // Unlike a missing hook, a hook that exists and throws is a real defect and
    // must stay visible.
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0]?.[1]).toBe(failure);
  });

  test('reports a TypeError that merely mentions the hook', () => {
    const calls: string[] = [];
    // A framework callback can fail with a `TypeError` naming the hook without
    // the hook being absent. Matching the name alone would swallow this, so the
    // predicate requires the engine's "not a function" shape.
    const failure = new TypeError(
      'callDestroyLifetimeFun received an unexpected argument',
    );
    registerDisposeHandler(
      rpc,
      nativeApp,
      (id) => calls.push(`destroyCard:${id}`),
      () => {
        throw failure;
      },
    );

    expect(() => handler()).not.toThrow();

    expect(calls).toStrictEqual(['destroyCard:0']);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0]?.[1]).toBe(failure);
  });

  test('stays quiet for the missing hook shape of each engine', () => {
    for (
      const message of [
        // V8 / SpiderMonkey
        'multiApps[0].callDestroyLifetimeFun is not a function',
        // JavaScriptCore
        'multiApps[0].callDestroyLifetimeFun is not a function. (In \'x()\', \'x\' is undefined)',
      ]
    ) {
      consoleError.mockClear();
      const calls: string[] = [];
      registerDisposeHandler(
        rpc,
        nativeApp,
        (id) => calls.push(`destroyCard:${id}`),
        () => {
          throw new TypeError(message);
        },
      );

      expect(() => handler()).not.toThrow();
      expect(calls).toStrictEqual(['destroyCard:0']);
      expect(consoleError).not.toHaveBeenCalled();
    }
  });
});
