// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import './jsdom.js';
import { afterEach, describe, expect, rstest, test } from '@rstest/core';
import { LynxViewElement } from '../ts/client/mainthread/LynxView.js';
import { BackgroundThread } from '../ts/client/mainthread/Background.js';
import { createMainThreadGlobalAPIs } from '../ts/client/mainthread/createMainThreadGlobalAPIs.js';
import type { LynxViewInstance } from '../ts/client/mainthread/LynxViewInstance.js';
import type { WorkerStartMessage } from '../ts/types/index.js';

const { setProfiling } = rstest.hoisted(() => ({ setProfiling: rstest.fn() }));

rstest.mock('../ts/client/mainthread/TemplateManager.js', () => ({
  templateManager: { fetchBundle: rstest.fn() },
}));
rstest.mock('../ts/client/mainthread/createIFrameRealm.js', () => ({
  createIFrameRealm: rstest.fn().mockResolvedValue({}),
}));
rstest.mock('../ts/client/mainthread/LynxViewInstance.js', () => ({
  LynxViewInstance: class {
    backgroundThread = { setProfiling };
    async [Symbol.asyncDispose]() {}
  },
}));

describe('lynx-view profiling', () => {
  afterEach(() => {
    document.body.replaceChildren();
    rstest.clearAllMocks();
    rstest.unstubAllGlobals();
  });

  test.each([
    ['', false],
    ['is-profiling', true],
    ['is-profiling="true"', true],
    ['is-profiling="false"', false],
  ])('reads profiling from HTML: %s', (attribute, expected) => {
    const container = document.createElement('div');
    container.innerHTML = `<lynx-view ${attribute}></lynx-view>`;
    const view = container.firstElementChild as LynxViewElement;
    expect(view.isProfiling).toBe(expected);
  });

  test('reflects property changes in the attribute and main-thread API', () => {
    rstest.stubGlobal('cancelAnimationFrame', rstest.fn());
    const view = new LynxViewElement();
    const { lynx } = createMainThreadGlobalAPIs({
      parentDom: view,
      backgroundThread: { markTiming: rstest.fn() },
      i18nManager: { _I18nResourceTranslation: rstest.fn() },
    } as unknown as LynxViewInstance);

    expect(lynx.performance.isProfileRecording()).toBe(false);
    view.isProfiling = true;
    expect(view.hasAttribute('is-profiling')).toBe(true);
    expect(lynx.performance.isProfileRecording()).toBe(true);
    view.isProfiling = false;
    expect(view.hasAttribute('is-profiling')).toBe(false);
    expect(lynx.performance.isProfileRecording()).toBe(false);
    view.setAttribute('is-profiling', 'true');
    expect(lynx.performance.isProfileRecording()).toBe(true);
    view.setAttribute('is-profiling', 'false');
    expect(lynx.performance.isProfileRecording()).toBe(false);
  });

  test('forwards attribute changes to the active background thread', async () => {
    const view = new LynxViewElement();
    view.url = 'http://localhost/main.web.bundle';
    document.body.append(view);
    // Let the asynchronous instance creation complete before changing attributes.
    await new Promise(resolve => setTimeout(resolve, 0));

    view.setAttribute('is-profiling', '');
    expect(setProfiling).toHaveBeenLastCalledWith(true);
    view.removeAttribute('is-profiling');
    expect(setProfiling).toHaveBeenLastCalledWith(false);
    view.isProfiling = true;
    expect(setProfiling).toHaveBeenLastCalledWith(true);
    view.isProfiling = false;
    expect(setProfiling).toHaveBeenLastCalledWith(false);
  });

  test.each([false, true])(
    'starts the worker with profiling set to %s',
    async (isProfiling) => {
      const postMessage = rstest.fn<(message: WorkerStartMessage) => void>();
      rstest.stubGlobal(
        'Worker',
        class {
          postMessage = postMessage;
          terminate() {}
        },
      );
      const view = new LynxViewElement();
      view.isProfiling = isProfiling;
      const background = new BackgroundThread(undefined, {
        parentDom: view,
        templateUrl: 'http://localhost/main.web.bundle',
        systemInfo: {},
      } as LynxViewInstance);
      try {
        background.startWebWorker({}, {}, 'react', {}, {}, {});
        expect(postMessage).toHaveBeenCalledTimes(1);
        expect(postMessage.mock.calls[0]![0].isProfiling).toBe(isProfiling);
      } finally {
        await background[Symbol.asyncDispose]();
        postMessage.mock.calls[0]?.[0].mainThreadMessagePort.close();
      }
    },
  );
});
