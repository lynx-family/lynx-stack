// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import './jsdom.js';
import { Rpc } from '@lynx-js/web-worker-rpc';
import { afterEach, describe, expect, rstest, test } from '@rstest/core';
import { createNativeModules } from '../ts/client/background/background-apis/createNativeModules.js';
import { LynxViewElement } from '../ts/client/mainthread/LynxView.js';
import { LynxViewInstance } from '../ts/client/mainthread/LynxViewInstance.js';
import type { JSRealm, WorkerStartMessage } from '../ts/types/index.js';

const { fetchBundleMock } = rstest.hoisted(() => ({
  fetchBundleMock: rstest.fn(),
}));
rstest.mock('../ts/client/mainthread/TemplateManager.js', () => ({
  templateManager: { fetchBundle: fetchBundleMock },
}));
rstest.mock('../ts/client/mainthread/createIFrameRealm.js', () => ({
  createIFrameRealm: rstest.fn(() => Promise.resolve({ globalWindow: {} })),
}));

describe('lynx-view nativeModulesInitData', () => {
  afterEach(() => {
    document.body.replaceChildren();
    rstest.clearAllMocks();
    rstest.unstubAllGlobals();
  });

  test('forwards snapshotted nativeModulesInitData to WorkerStartMessage', async () => {
    rstest.stubGlobal('cancelAnimationFrame', rstest.fn());
    const postMessage = rstest.fn<(message: WorkerStartMessage) => void>();
    rstest.stubGlobal(
      'Worker',
      class {
        postMessage = postMessage;
        terminate() {}
      },
    );

    const view = new LynxViewElement();
    const initialData = {
      CustomBridge: {
        city: 'beijing',
        options: { theme: 'light', tags: ['a'] },
      },
    };
    view.nativeModulesInitData = initialData;

    const instance = new LynxViewInstance(
      view,
      {},
      {},
      'http://localhost/main.web.bundle',
      view.shadowRoot ?? view.attachShadow({ mode: 'open' }),
      { globalWindow: {} } as JSRealm,
      false,
      undefined,
    );

    try {
      view.nativeModulesInitData = {
        CustomBridge: {
          city: 'shanghai',
          options: { theme: 'dark', tags: ['c'] },
        },
      };
      instance.backgroundThread.startWebWorker(
        {},
        {},
        'react',
        {},
        { CustomBridge: 'https://example.com/bridge.js' },
        {},
      );
      expect(postMessage).toHaveBeenCalledTimes(1);
      expect(postMessage.mock.calls[0]![0].nativeModulesInitData).toEqual(
        initialData,
      );
    } finally {
      await instance[Symbol.asyncDispose]();
      postMessage.mock.calls[0]?.[0].mainThreadMessagePort.close();
    }
  });

  test('delivers sendNativeModuleEvent via public API over backgroundThread RPC', async () => {
    rstest.stubGlobal('cancelAnimationFrame', rstest.fn());
    const postMessage = rstest.fn<(message: WorkerStartMessage) => void>();
    rstest.stubGlobal(
      'Worker',
      class {
        postMessage = postMessage;
        terminate() {}
      },
    );

    const moduleUrl = `data:text/javascript,${
      encodeURIComponent(`
      export default function createModule(_nativeModules, _call, context) {
        const received = [];
        let resolveFirst;
        const firstEvent = new Promise((resolve) => {
          resolveFirst = resolve;
        });
        context.setEventHandler((data) => {
          received.push(data);
          resolveFirst();
        });
        return {
          firstEvent,
          getReceived() {
            return received;
          },
        };
      }
    `)
    }`;

    let capturedInstancePromise: Promise<LynxViewInstance> | undefined;
    let resolveFetch!: () => void;
    const fetchCalled = new Promise<void>((resolve) => {
      resolveFetch = resolve;
    });
    fetchBundleMock.mockImplementationOnce(
      (_url: string, instancePromise: Promise<LynxViewInstance>) => {
        capturedInstancePromise = instancePromise;
        resolveFetch();
      },
    );

    // Calling sendNativeModuleEvent on an unmounted LynxViewElement is a safe no-op.
    const unmountedView = new LynxViewElement();
    expect(() =>
      unmountedView.sendNativeModuleEvent('CustomBridge', { ignored: true })
    ).not.toThrow();

    const view = new LynxViewElement();
    view.url = 'http://localhost/main.web.bundle';
    view.nativeModulesMap = { CustomBridge: moduleUrl };
    document.body.appendChild(view);

    await fetchCalled;
    const instance = await capturedInstancePromise!;
    await Promise.resolve();

    try {
      // Events sent before the worker MessagePort attaches and before module
      // loading finishes are buffered by Rpc and replayed in order.
      view.sendNativeModuleEvent('CustomBridge', {
        type: 'event',
        params: { nested: { theme: 'dark' } },
      });

      instance.backgroundThread.startWebWorker(
        {},
        {},
        'react',
        {},
        { CustomBridge: moduleUrl },
        {},
      );

      const workerPort = postMessage.mock.calls[0]![0].mainThreadMessagePort;
      const workerRpc = new Rpc(workerPort, 'bg-to-main');
      const nativeModules = await createNativeModules(
        workerRpc,
        workerRpc,
        { CustomBridge: moduleUrl },
      );

      await nativeModules.CustomBridge.firstEvent;
      expect(nativeModules.CustomBridge.getReceived()).toEqual([
        {
          type: 'event',
          params: { nested: { theme: 'dark' } },
        },
      ]);
    } finally {
      view.remove();
      await instance[Symbol.asyncDispose]();
      postMessage.mock.calls[0]?.[0].mainThreadMessagePort.close();
    }
  });
});
