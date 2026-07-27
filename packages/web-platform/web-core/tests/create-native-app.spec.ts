// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, rstest, test } from '@rstest/core';
import type { Rpc } from '@lynx-js/web-worker-rpc';
import {
  queryComponentEndpoint,
  updateBTSChunkEndpoint,
} from '../ts/client/endpoints.js';
import { createNativeApp } from '../ts/client/background/background-apis/createNativeApp.js';
import type { TimingSystem } from '../ts/client/background/background-apis/createTimingSystem.js';

type RpcHandler = (...args: unknown[]) => unknown;
type QueryComponentResponse = {
  code: number;
  detail: {
    schema: string;
  };
};

function createMainThreadRpc(
  queryComponent: (url: string) => Promise<QueryComponentResponse>,
): {
  rpc: Rpc;
  handlers: Map<string, RpcHandler>;
} {
  const handlers = new Map<string, RpcHandler>();
  const noOpCall = rstest.fn(() => Promise.resolve(undefined));

  return {
    rpc: {
      createCall: rstest.fn((endpoint: { name: string }) => {
        return endpoint.name === queryComponentEndpoint.name
          ? queryComponent
          : noOpCall;
      }),
      createCallbackify: rstest.fn(() => rstest.fn()),
      registerHandler: rstest.fn((
        endpoint: { name: string },
        handler: RpcHandler,
      ) => {
        handlers.set(endpoint.name, handler);
      }),
      invoke: rstest.fn(() => Promise.resolve(undefined)),
    } as unknown as Rpc,
    handlers,
  };
}

const timingSystem = {
  registerGlobalEmitter: rstest.fn(),
  markTimingInternal: rstest.fn(),
  pipelineIdToTimingFlags: new Map<string, string[]>(),
} as TimingSystem;

describe('createNativeApp', () => {
  test('waits for the main-thread query when the background chunk is cached', async () => {
    const source = '/lazy-component.web.bundle';
    const query = Promise.withResolvers<QueryComponentResponse>();
    const queryComponent = rstest.fn(() => query.promise);
    const { rpc, handlers } = createMainThreadRpc(queryComponent);
    const nativeApp = await createNativeApp(
      rpc,
      timingSystem,
      {},
      '/main.web.bundle',
      'react',
    );
    handlers.get(updateBTSChunkEndpoint.name)?.(
      source,
      { '/app-service.js': 'blob:background-chunk' },
    );
    const callback = rstest.fn();

    nativeApp.queryComponent(source, callback);

    expect(queryComponent).toHaveBeenCalledWith(source);
    expect(callback).not.toHaveBeenCalled();

    const response = {
      code: 0,
      detail: { schema: source },
    };
    query.resolve(response);
    await query.promise;
    await Promise.resolve();

    expect(callback).toHaveBeenCalledWith(response);
  });

  test('forwards the main-thread response for an uncached component', async () => {
    const source = '/lazy-component.web.bundle';
    const response: QueryComponentResponse = {
      code: 0,
      detail: { schema: source },
    };
    const queryComponent = rstest.fn(() => Promise.resolve(response));
    const { rpc } = createMainThreadRpc(queryComponent);
    const nativeApp = await createNativeApp(
      rpc,
      timingSystem,
      {},
      '/main.web.bundle',
      'react',
    );
    const callback = rstest.fn();

    nativeApp.queryComponent(source, callback);
    await Promise.resolve();

    expect(callback).toHaveBeenCalledWith(response);
  });
});
