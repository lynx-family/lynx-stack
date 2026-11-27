// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, rstest, test } from '@rstest/core';
import type { Rpc } from '@lynx-js/web-worker-rpc';
import {
  dispatchIntersectionObserverEventEndpoint,
  dispatchNativeModuleEventEndpoint,
  intersectionObserverCommandEndpoint,
  nativeModulesCallEndpoint,
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
      registerHandlerLazy: rstest.fn(),
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
  test.each([undefined, false, true])(
    'initializes profiling with %s independently for each app',
    async (isProfiling) => {
      const queryComponent = rstest.fn();
      const { rpc } = createMainThreadRpc(queryComponent);
      const otherRpc = createMainThreadRpc(queryComponent);
      const nativeApp = await createNativeApp(
        rpc,
        timingSystem,
        {},
        '/main.web.bundle',
        'react',
        isProfiling,
      );
      const otherApp = await createNativeApp(
        otherRpc.rpc,
        timingSystem,
        {},
        '/other.web.bundle',
        'react',
      );

      expect(nativeApp.isProfileRecording()).toBe(isProfiling ?? false);
      expect(otherApp.isProfileRecording()).toBe(false);
    },
  );

  test('setCard gives the background lynx an empty chunk-entry map', async () => {
    const { rpc } = createMainThreadRpc(rstest.fn());
    const nativeApp = await createNativeApp(
      rpc,
      timingSystem,
      {},
      '/main.web.bundle',
      'react',
    );
    const context = { __start: rstest.fn() };
    const lynx: Record<string, unknown> = {
      getCoreContext: () => context,
      getDevtool: () => context,
    };

    nativeApp.setCard(
      { lynx } as unknown as Parameters<
        typeof nativeApp.setCard
      >[0],
    );

    // What the CSS hot update runtime reads for each chunk.
    expect(lynx['__chunk_entries__']).toEqual({});
  });

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

  test('passes per-module nativeModulesInitData via the 3rd context argument', async () => {
    const moduleUrl = `data:text/javascript,${
      encodeURIComponent(`
      export default function createModule(nativeModules, call, context) {
        return {
          getInitData() {
            return context?.initData;
          },
          hasSharedModules() {
            return typeof nativeModules === 'object' && nativeModules !== null;
          },
          invokeHost(method, payload) {
            return call(method, payload);
          },
        };
      }
    `)
    }`;

    const first = createMainThreadRpc(() =>
      Promise.resolve({ code: 0, detail: { schema: '' } })
    );
    const second = createMainThreadRpc(() =>
      Promise.resolve({ code: 0, detail: { schema: '' } })
    );

    const firstApp = await createNativeApp(
      first.rpc,
      timingSystem,
      {
        UnconfiguredModule: moduleUrl,
        ConfiguredModule: moduleUrl,
        NullModule: moduleUrl,
        FalseModule: moduleUrl,
        ZeroModule: moduleUrl,
      },
      '/main.web.bundle',
      'react',
      false,
      {
        ConfiguredModule: {
          city: 'beijing',
          options: { theme: 'light', tags: ['a', 'b'] },
        },
        NullModule: null,
        FalseModule: false,
        ZeroModule: 0,
      },
    );
    const secondApp = await createNativeApp(
      second.rpc,
      timingSystem,
      {
        ConfiguredModule: moduleUrl,
      },
      '/other.web.bundle',
      'react',
      false,
      {
        ConfiguredModule: {
          city: 'shanghai',
          options: { theme: 'dark', tags: ['c'] },
        },
      },
    );

    expect(firstApp.nativeModuleProxy.UnconfiguredModule.getInitData())
      .toBeUndefined();
    expect(firstApp.nativeModuleProxy.NullModule.getInitData()).toBeNull();
    expect(firstApp.nativeModuleProxy.FalseModule.getInitData()).toBe(false);
    expect(firstApp.nativeModuleProxy.ZeroModule.getInitData()).toBe(0);
    expect(firstApp.nativeModuleProxy.UnconfiguredModule.hasSharedModules())
      .toBe(true);
    expect(firstApp.nativeModuleProxy.ConfiguredModule.getInitData()).toEqual({
      city: 'beijing',
      options: { theme: 'light', tags: ['a', 'b'] },
    });
    expect(secondApp.nativeModuleProxy.ConfiguredModule.getInitData()).toEqual({
      city: 'shanghai',
      options: { theme: 'dark', tags: ['c'] },
    });

    await firstApp.nativeModuleProxy.ConfiguredModule.invokeHost('getStorage', {
      key: 'token',
    });
    expect(
      first.calls.filter(
        ({ endpointName }) => endpointName === nativeModulesCallEndpoint.name,
      ),
    ).toEqual([
      {
        endpointName: nativeModulesCallEndpoint.name,
        args: ['getStorage', { key: 'token' }, 'ConfiguredModule'],
      },
    ]);
  });

  test('routes host events to per-module and per-app handlers via context.setEventHandler', async () => {
    const moduleUrl = `data:text/javascript,${
      encodeURIComponent(`
      export default function createModule(_nativeModules, _call, context) {
        const received = [];
        context.setEventHandler((data) => {
          received.push(data);
        });
        return {
          getReceived() {
            return received;
          },
          setHandler(handler) {
            context.setEventHandler(handler);
          },
        };
      }
    `)
    }`;

    const first = createMainThreadRpc(() =>
      Promise.resolve({ code: 0, detail: { schema: '' } })
    );
    const second = createMainThreadRpc(() =>
      Promise.resolve({ code: 0, detail: { schema: '' } })
    );

    const firstAppPromise = createNativeApp(
      first.rpc,
      timingSystem,
      {
        ModuleA: moduleUrl,
        ModuleB: moduleUrl,
      },
      '/main.web.bundle',
      'react',
    );
    const secondAppPromise = createNativeApp(
      second.rpc,
      timingSystem,
      {
        ModuleA: moduleUrl,
      },
      '/other.web.bundle',
      'react',
    );

    // Handler is only registered after modules finish initializing so Rpc's
    // built-in message cache buffers events arriving during dynamic import.
    expect(
      first.handlers.has(dispatchNativeModuleEventEndpoint.name),
    ).toBe(false);

    const [firstApp, secondApp] = await Promise.all([
      firstAppPromise,
      secondAppPromise,
    ]);

    const dispatchFirst = first.handlers.get(
      dispatchNativeModuleEventEndpoint.name,
    )!;
    const dispatchSecond = second.handlers.get(
      dispatchNativeModuleEventEndpoint.name,
    )!;
    dispatchFirst('ModuleA', { seq: 1 });
    dispatchFirst('ModuleA', { seq: 2 });
    dispatchFirst('UnknownModule', { ignored: true });
    dispatchSecond('ModuleA', { seq: 100 });

    expect(firstApp.nativeModuleProxy.ModuleA.getReceived()).toEqual([
      { seq: 1 },
      { seq: 2 },
    ]);
    expect(firstApp.nativeModuleProxy.ModuleB.getReceived()).toEqual([]);
    expect(secondApp.nativeModuleProxy.ModuleA.getReceived()).toEqual([
      { seq: 100 },
    ]);

    // Post-load events are isolated per module and per app instance.
    dispatchFirst('ModuleB', { target: 'B' });
    dispatchSecond('ModuleA', { seq: 101 });
    expect(firstApp.nativeModuleProxy.ModuleA.getReceived()).toEqual([
      { seq: 1 },
      { seq: 2 },
    ]);
    expect(firstApp.nativeModuleProxy.ModuleB.getReceived()).toEqual([
      { target: 'B' },
    ]);
    expect(secondApp.nativeModuleProxy.ModuleA.getReceived()).toEqual([
      { seq: 100 },
      { seq: 101 },
    ]);

    // Replacing and clearing the handler updates routing for that module only.
    const replacedReceived: unknown[] = [];
    firstApp.nativeModuleProxy.ModuleA.setHandler((data: unknown) => {
      replacedReceived.push(data);
    });
    dispatchFirst('ModuleA', { seq: 3 });
    expect(firstApp.nativeModuleProxy.ModuleA.getReceived()).toEqual([
      { seq: 1 },
      { seq: 2 },
    ]);
    expect(replacedReceived).toEqual([{ seq: 3 }]);

    firstApp.nativeModuleProxy.ModuleA.setHandler(undefined);
    dispatchFirst('ModuleA', { seq: 4 });
    expect(replacedReceived).toEqual([{ seq: 3 }]);

    // Handler exceptions are caught and logged without crashing dispatch.
    const errorSpy = rstest.spyOn(console, 'error').mockImplementation(
      () => {},
    );
    try {
      firstApp.nativeModuleProxy.ModuleA.setHandler(() => {
        throw new Error('handler failure');
      });
      expect(() => dispatchFirst('ModuleA', { seq: 5 })).not.toThrow();
      expect(errorSpy).toHaveBeenCalledTimes(1);
    } finally {
      errorSpy.mockRestore();
    }
  });
});
