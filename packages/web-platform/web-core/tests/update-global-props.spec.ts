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
import { Rpc } from '@lynx-js/web-worker-rpc';
import {
  updateDataEndpoint,
  updateGlobalPropsEndpoint,
} from '../ts/client/endpoints.js';
import { EngineMessageEventType } from '../ts/constants.js';
import type {
  Cloneable,
  JSRealm,
  PageConfig,
  WorkerStartMessage,
} from '../ts/types/index.js';
import type { LynxViewElement } from '../ts/client/mainthread/LynxView.js';
import { LynxViewInstance } from '../ts/client/mainthread/LynxViewInstance.js';
import { templateManager } from '../ts/client/mainthread/TemplateManager.js';

const pageConfig: PageConfig = {
  enableCSSSelector: 'false',
  enableRemoveCSSScope: 'false',
  defaultDisplayLinear: 'true',
  defaultOverflowVisible: 'false',
  enableJSDataProcessor: 'false',
  isLazy: 'false',
  cardType: 'card',
};

function createCard(
  globalProps: Cloneable = {},
) {
  rstest.stubGlobal('cancelAnimationFrame', rstest.fn());
  const host = document.createElement('div') as unknown as LynxViewElement;
  const card = new LynxViewInstance(
    host,
    {},
    globalProps,
    'http://localhost/card.web.bundle',
    host.attachShadow({ mode: 'open' }),
    { globalWindow: { Object, Array } } as JSRealm,
    false,
    undefined,
  );
  rstest.spyOn(templateManager, 'getBundle').mockReturnValue({
    config: pageConfig,
  });
  return card;
}

function observeBackground() {
  let startup: WorkerStartMessage | undefined;
  const updates: Cloneable[] = [];
  // Stand in for the worker bootstrap. BackgroundThread and Rpc still create,
  // queue and deliver messages through a real MessageChannel.
  rstest.stubGlobal(
    'Worker',
    class {
      postMessage(message: WorkerStartMessage) {
        startup = message;
        const rpc = new Rpc(message.mainThreadMessagePort, 'test-worker');
        rpc.registerHandler(updateGlobalPropsEndpoint, (props) => {
          updates.push(props);
        });
        rpc.registerHandler(updateDataEndpoint, () => {});
      }
      terminate() {
        startup?.mainThreadMessagePort.close();
      }
    },
  );
  return {
    updates,
    get startup() {
      return startup;
    },
  };
}

describe('main-thread updateGlobalProps', () => {
  let background: ReturnType<typeof observeBackground>;

  beforeEach(() => {
    background = observeBackground();
  });

  afterEach(() => {
    rstest.restoreAllMocks();
    rstest.unstubAllGlobals();
  });

  test('updates props aliases before the Engine listener and direct fallback', async () => {
    await using card = createCard();
    const initial = { theme: 'initial' };
    await card.updateGlobalProps(initial);
    expect(card.globalprops).toEqual(initial);
    expect(card.mainThreadGlobalThis.__globalProps).toBe(card.globalprops);
    card.onPageConfigReady(pageConfig);
    const global = card.mainThreadGlobalThis;
    expect(global.lynx.__globalProps).toBe(card.globalprops);

    const snapshots: unknown[] = [];
    const record = (source: string, data: unknown) => {
      snapshots.push([
        source,
        data,
        card.globalprops,
        global.__globalProps,
        global.lynx.__globalProps,
      ]);
    };
    global.lynx.getEngine().addEventListener(
      EngineMessageEventType.UpdateGlobalProps,
      ({ data }) => record('engine', data?.[0]),
      { once: true },
    );
    global.updateGlobalProps = data => record('fallback', data);
    await card.updateGlobalProps('engine props');
    await card.updateGlobalProps('fallback props');

    expect(snapshots).toEqual([
      [
        'engine',
        'engine props',
        'engine props',
        'engine props',
        'engine props',
      ],
      [
        'fallback',
        'fallback props',
        'fallback props',
        'fallback props',
        'fallback props',
      ],
    ]);
  });

  test('uses the latest props at startup and still notifies MTS during processData', async () => {
    await using card = createCard({ theme: 'initial' });
    const first = card.updateGlobalProps('A');
    card.onPageConfigReady(pageConfig);
    const global = card.mainThreadGlobalThis;
    const notifications: unknown[] = [];
    global.lynx.getEngine().addEventListener(
      EngineMessageEventType.UpdateGlobalProps,
      ({ data }) => notifications.push(data?.[0]),
    );
    global.processData = (data: Cloneable) => {
      void card.updateGlobalProps('B');
      return data;
    };
    const render = rstest.fn(() => global.lynx.__globalProps);
    global.renderPage = render;

    card.onMTSScriptsExecuted();
    await first;
    // An acknowledged RPC drains earlier messages on the same port.
    await card.backgroundThread.updateData(undefined, undefined);

    expect(background.startup?.globalProps).toBe('B');
    expect(background.updates).toEqual([]);
    expect(notifications).toEqual(['B']);
    expect(render).toHaveReturnedWith('B');
  });

  test('sends reentrant updates to BTS in the same order as MTS', async () => {
    await using card = createCard();
    card.onPageConfigReady(pageConfig);
    card.onMTSScriptsExecuted();
    const global = card.mainThreadGlobalThis;
    const seen: unknown[] = [];
    global.updateGlobalProps = data => {
      seen.push(data);
      if (data === 'A') void card.updateGlobalProps('B');
    };

    await card.updateGlobalProps('A');
    await card.backgroundThread.updateData(undefined, undefined);

    expect(seen).toEqual(['A', 'B']);
    expect(background.updates).toEqual(['A', 'B']);
    expect(global.lynx.__globalProps).toBe('B');
  });

  test('logs a throwing fallback and still sends the update to BTS', async () => {
    await using card = createCard();
    card.onPageConfigReady(pageConfig);
    card.onMTSScriptsExecuted();
    const error = new Error('props callback failed');
    const logError = rstest.spyOn(console, 'error').mockImplementation(
      () => {},
    );
    card.mainThreadGlobalThis.updateGlobalProps = () => {
      throw error;
    };

    await expect(card.updateGlobalProps('next')).resolves.toBeUndefined();
    await card.backgroundThread.updateData(undefined, undefined);

    expect(logError).toHaveBeenCalledWith(
      '[lynx-web] error in globalThis.updateGlobalProps',
      error,
    );
    expect(background.updates).toEqual(['next']);
  });

  test('notifies MTS and rejects when the synchronous BTS send fails', async () => {
    await using card = createCard();
    card.onPageConfigReady(pageConfig);
    card.onMTSScriptsExecuted();
    const error = new Error('Unable to send props');
    rstest.spyOn(card.backgroundThread, 'updateGlobalProps').mockImplementation(
      () => {
        throw error;
      },
    );
    const fallback = rstest.fn();
    card.mainThreadGlobalThis.updateGlobalProps = fallback;

    await expect(card.updateGlobalProps('next')).rejects.toBe(error);
    expect(fallback).toHaveBeenCalledExactlyOnceWith('next');
    expect(card.mainThreadGlobalThis.lynx.__globalProps).toBe('next');
  });
});
