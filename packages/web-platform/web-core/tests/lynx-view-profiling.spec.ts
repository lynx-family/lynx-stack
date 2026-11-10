// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import './jsdom.js';
import { afterEach, describe, expect, rstest, test } from '@rstest/core';
import { LynxViewElement } from '../ts/client/mainthread/LynxView.js';
import { createMainThreadGlobalAPIs } from '../ts/client/mainthread/createMainThreadGlobalAPIs.js';
import { LynxViewInstance } from '../ts/client/mainthread/LynxViewInstance.js';
import type { JSRealm, WorkerStartMessage } from '../ts/types/index.js';

rstest.mock('../ts/client/mainthread/TemplateManager.js', () => ({
  templateManager: { fetchBundle: rstest.fn() },
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

  test('reflects property changes in the attribute', () => {
    const view = new LynxViewElement();
    view.isProfiling = true;
    expect(view.hasAttribute('is-profiling')).toBe(true);
    view.isProfiling = false;
    expect(view.hasAttribute('is-profiling')).toBe(false);
    view.setAttribute('is-profiling', 'true');
    expect(view.isProfiling).toBe(true);
    view.setAttribute('is-profiling', 'false');
    expect(view.isProfiling).toBe(false);
  });

  test.each([false, true])(
    'preserves the initial profiling value %s in both threads',
    async (isProfiling) => {
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
      view.isProfiling = isProfiling;
      const createInstance = () =>
        new LynxViewInstance(
          view,
          {},
          {},
          'http://localhost/main.web.bundle',
          view.shadowRoot ?? view.attachShadow({ mode: 'open' }),
          { globalWindow: {} } as JSRealm,
          false,
          undefined,
        );
      const instance = createInstance();
      try {
        // Changes after instance creation must not affect either runtime,
        // even if the background worker has not started yet.
        view.isProfiling = !isProfiling;
        const { lynx } = createMainThreadGlobalAPIs(instance);
        expect(lynx.performance.isProfileRecording()).toBe(isProfiling);
        instance.backgroundThread.startWebWorker({}, {}, 'react', {}, {}, {});
        expect(postMessage).toHaveBeenCalledTimes(1);
        expect(postMessage.mock.calls[0]![0].isProfiling).toBe(isProfiling);
      } finally {
        await instance[Symbol.asyncDispose]();
        postMessage.mock.calls[0]?.[0].mainThreadMessagePort.close();
      }

      const reloaded = createInstance();
      try {
        expect(
          createMainThreadGlobalAPIs(reloaded).lynx.performance
            .isProfileRecording(),
        )
          .toBe(!isProfiling);
      } finally {
        await reloaded[Symbol.asyncDispose]();
      }
    },
  );
});
