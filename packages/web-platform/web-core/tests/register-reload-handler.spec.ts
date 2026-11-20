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
 * `registerReloadHandler` is the main-thread side of `lynx.reload()`. The
 * background thread has no DOM, so the optional new initial data has to be
 * forwarded here, to the `<lynx-view>` element that owns `initData`.
 */
describe('registerReloadHandler', () => {
  const createRpc = (
    onRegister?: (endpoint: { name: string }) => void,
  ): { rpc: Rpc; getHandler: () => (value: unknown) => unknown } => {
    let handler: (value: unknown) => unknown = () => {
      throw new Error('reload handler was never registered');
    };
    const rpc = {
      registerHandler: (
        endpoint: { name: string },
        fn: (value: unknown) => unknown,
      ) => {
        onRegister?.(endpoint);
        handler = fn;
      },
    } as unknown as Rpc;
    return { rpc, getHandler: () => handler };
  };

  test('forwards the reload value to the parent lynx-view', () => {
    let registeredEndpointName: string | undefined;
    const { rpc, getHandler } = createRpc((endpoint) => {
      registeredEndpointName = endpoint.name;
    });

    const calls: unknown[] = [];
    const lynxViewInstance = {
      parentDom: {
        reload: (value: unknown) => {
          calls.push(value);
        },
      },
    } as unknown as LynxViewInstance;

    registerReloadHandler(rpc, lynxViewInstance);
    expect(registeredEndpointName).toBe(reloadEndpoint.name);

    getHandler()({ mockData: 'reloaded' });

    expect(calls).toStrictEqual([{ mockData: 'reloaded' }]);
  });

  test('reloads with no new data when the background thread omits a value', () => {
    const { rpc, getHandler } = createRpc();

    const calls: unknown[] = [];
    const lynxViewInstance = {
      parentDom: {
        reload: (value: unknown) => {
          calls.push(value);
        },
      },
    } as unknown as LynxViewInstance;

    registerReloadHandler(rpc, lynxViewInstance);
    getHandler()(undefined);

    expect(calls).toStrictEqual([undefined]);
  });

  test('returns nothing so the RPC layer does not try to reply', () => {
    // `reloadEndpoint` is declared without a return value: the reload disposes
    // the calling background thread, so a reply would be posted to a closed
    // port. Returning `parentDom.reload()`'s value here would make the handler
    // look awaitable and hide that.
    const { rpc, getHandler } = createRpc();
    const lynxViewInstance = {
      parentDom: {
        reload: () => Promise.resolve('should not be forwarded'),
      },
    } as unknown as LynxViewInstance;

    registerReloadHandler(rpc, lynxViewInstance);

    expect(getHandler()({ mockData: 'reloaded' })).toBeUndefined();
  });
});
