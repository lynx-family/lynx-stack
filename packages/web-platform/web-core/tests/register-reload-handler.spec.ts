// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import './jsdom.js';
import { describe, expect, test } from '@rstest/core';
import { registerReloadHandler } from '../ts/client/mainthread/crossThreadHandlers/registerReloadHandler.js';
import { reloadEndpoint } from '../ts/client/endpoints.js';
import type { LynxViewInstance } from '../ts/client/mainthread/LynxViewInstance.js';
import type { Rpc } from '@lynx-js/web-worker-rpc';

/**
 * `registerReloadHandler` is the main-thread side of `lynx.reload()`. It
 * forwards the optional new initial data to `LynxViewElement.reload()` and
 * hands the RPC layer that call's promise, so the background thread's
 * `lynx.reload(value, callback)` only invokes `callback` once the reloaded
 * page has actually finished rendering.
 */
describe('registerReloadHandler', () => {
  test('forwards the reload value to the parent lynx-view and awaits it', async () => {
    let handler: (value: unknown) => unknown = () => {
      throw new Error('reload handler was never registered');
    };
    const rpc = {
      registerHandler: (
        endpoint: { name: string },
        fn: (value: unknown) => unknown,
      ) => {
        expect(endpoint.name).toBe(reloadEndpoint.name);
        handler = fn;
      },
    } as unknown as Rpc;

    const calls: unknown[] = [];
    let resolveReload!: () => void;
    const lynxViewInstance = {
      parentDom: {
        reload: (value: unknown) => {
          calls.push(value);
          return new Promise<void>((resolve) => {
            resolveReload = resolve;
          });
        },
      },
    } as unknown as LynxViewInstance;

    registerReloadHandler(rpc, lynxViewInstance);

    let settled = false;
    const returned = Promise.resolve(handler({ mockData: 'reloaded' })).then(
      () => {
        settled = true;
      },
    );

    expect(calls).toStrictEqual([{ mockData: 'reloaded' }]);
    expect(settled).toBe(false);

    resolveReload();
    await returned;

    expect(settled).toBe(true);
  });

  test('reloads with no new data when the background thread omits a value', () => {
    let handler: (value: unknown) => unknown = () => {
      throw new Error('reload handler was never registered');
    };
    const rpc = {
      registerHandler: (
        _endpoint: { name: string },
        fn: (value: unknown) => unknown,
      ) => {
        handler = fn;
      },
    } as unknown as Rpc;

    const calls: unknown[] = [];
    const lynxViewInstance = {
      parentDom: {
        reload: (value: unknown) => {
          calls.push(value);
        },
      },
    } as unknown as LynxViewInstance;

    registerReloadHandler(rpc, lynxViewInstance);
    handler(undefined);

    expect(calls).toStrictEqual([undefined]);
  });
});
