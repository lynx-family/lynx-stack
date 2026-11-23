// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import './jsdom.js';
import { afterEach, describe, expect, rstest, test } from '@rstest/core';
import { LynxViewElement } from '../ts/client/mainthread/LynxView.js';
import { LynxViewInstance } from '../ts/client/mainthread/LynxViewInstance.js';
import type { JSRealm, WorkerStartMessage } from '../ts/types/index.js';

rstest.mock('../ts/client/mainthread/TemplateManager.js', () => ({
  templateManager: { fetchBundle: rstest.fn() },
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
});
