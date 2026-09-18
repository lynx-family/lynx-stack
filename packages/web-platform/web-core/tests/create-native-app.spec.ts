// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, rstest, test } from '@rstest/core';
import type { Rpc } from '@lynx-js/web-worker-rpc';
import {
  dispatchIntersectionObserverEventEndpoint,
  intersectionObserverCommandEndpoint,
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
type RpcCall = {
  args: unknown[];
  endpointName: string;
};

function createMainThreadRpc(
  queryComponent: (url: string) => Promise<QueryComponentResponse>,
): {
  rpc: Rpc;
  handlers: Map<string, RpcHandler>;
  calls: RpcCall[];
} {
  const handlers = new Map<string, RpcHandler>();
  const calls: RpcCall[] = [];

  return {
    rpc: {
      createCall: rstest.fn((endpoint: { name: string }) => {
        return endpoint.name === queryComponentEndpoint.name
          ? queryComponent
          : (...args: unknown[]) => {
            calls.push({
              args,
              endpointName: endpoint.name,
            });
            return Promise.resolve(undefined);
          };
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
    calls,
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

  test('exposes the IntersectionObserver native module over RPC', async () => {
    const { calls, rpc } = createMainThreadRpc(() =>
      Promise.resolve({
        code: 0,
        detail: { schema: '' },
      })
    );
    const nativeApp = await createNativeApp(
      rpc,
      timingSystem,
      {},
      '/main.web.bundle',
      'react',
    );
    const module = nativeApp.nativeModuleProxy.IntersectionObserverModule;

    module.createIntersectionObserver(1, 'component-id', {
      thresholds: [0.5],
      initialRatio: -1,
    });
    module.relativeTo(1, '#root', { top: 10 });
    module.relativeToViewport(1, { right: 20 });
    module.relativeToScreen(1, { bottom: 30 });
    module.observe(1, '#target', 4);
    module.disconnect(1);

    expect(
      calls.filter(({ endpointName }) =>
        endpointName === intersectionObserverCommandEndpoint.name
      ).map(({ args }) => args[0]),
    ).toEqual([
      {
        componentId: 'component-id',
        observerId: 1,
        options: {
          initialRatio: -1,
          observeAll: false,
          thresholds: [0.5],
        },
        type: 'create',
      },
      {
        margins: {
          bottom: 0,
          left: 0,
          right: 0,
          top: 10,
        },
        observerId: 1,
        selector: '#root',
        type: 'relativeTo',
      },
      {
        margins: {
          bottom: 0,
          left: 0,
          right: 20,
          top: 0,
        },
        observerId: 1,
        type: 'relativeToViewport',
      },
      {
        margins: {
          bottom: 30,
          left: 0,
          right: 0,
          top: 0,
        },
        observerId: 1,
        type: 'relativeToScreen',
      },
      {
        callbackId: 4,
        observerId: 1,
        selector: '#target',
        type: 'observe',
      },
      {
        observerId: 1,
        type: 'disconnect',
      },
    ]);
  });

  test('dispatches main-thread intersection events to lynx-core', async () => {
    const { handlers, rpc } = createMainThreadRpc(() =>
      Promise.resolve({
        code: 0,
        detail: { schema: '' },
      })
    );
    const nativeApp = await createNativeApp(
      rpc,
      timingSystem,
      {},
      '/main.web.bundle',
      'react',
    );
    const onIntersectionObserverEvent = rstest.fn();
    nativeApp.tt = {
      onIntersectionObserverEvent,
    } as never;
    const payload = {
      boundingClientRect: { bottom: 40, left: 10, right: 30, top: 20 },
      intersectionRatio: 1,
      intersectionRect: { bottom: 40, left: 10, right: 30, top: 20 },
      isIntersecting: true,
      observerId: 'target',
      relativeRect: { bottom: 100, left: 0, right: 100, top: 0 },
      time: 0,
    };

    handlers.get(dispatchIntersectionObserverEventEndpoint.name)?.(
      2,
      3,
      payload,
    );

    expect(onIntersectionObserverEvent).toHaveBeenCalledWith(2, 3, payload);
  });
});
