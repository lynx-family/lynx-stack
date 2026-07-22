/*
 * Copyright 2026 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

import './jsdom.js';
import { expect, rstest, test } from '@rstest/core';
import type { Rpc } from '@lynx-js/web-worker-rpc';

import { createBackgroundLynx } from '../ts/client/background/background-apis/createBackgroundLynx.js';
import { createChunkLoading } from '../ts/client/background/background-apis/createChunkLoading.js';
import { createQueryComponent } from '../ts/client/background/background-apis/createQueryComponent.js';
import { getExecutionSourceURL } from '../ts/client/executionSourceURL.js';
import type { NativeApp } from '../ts/types/NativeApp.js';

test('execution source URLs keep nested section names in one path segment', () => {
  expect(
    getExecutionSourceURL(
      'https://cdn.example.com/remotes/catalog.web.bundle',
      'nested/catalog',
    ),
  ).toBe(
    'https://cdn.example.com/remotes/catalog.web.bundle/nested%2Fcatalog',
  );
});

test('QueryComponent shares an in-flight request after its template is decoded', async () => {
  type Result = Parameters<Parameters<NativeApp['queryComponent']>[1]>[0];
  let resolveQuery!: (result: Result) => void;
  const query = rstest.fn(
    () =>
      new Promise<Result>(resolve => {
        resolveQuery = resolve;
      }),
  );
  let isReady = false;
  const queryComponent = createQueryComponent(query, () => isReady);
  const first = rstest.fn();
  const second = rstest.fn();

  queryComponent('shared.bundle', first);
  isReady = true;
  queryComponent('shared.bundle', second);
  resolveQuery({ code: 0, detail: { schema: 'shared.bundle' } });
  await new Promise(resolve => setTimeout(resolve, 0));

  expect(query).toHaveBeenCalledTimes(1);
  expect(first).toHaveBeenCalledWith({
    code: 0,
    detail: { schema: 'shared.bundle' },
  });
  expect(second).toHaveBeenCalledWith({
    code: 0,
    detail: { schema: 'shared.bundle' },
  });
});

test('background lynx loads lazy bundle exports through Lynx Core', async () => {
  const exports = { ids: ['shared'], modules: {} };
  const loadDynamicComponent = rstest.fn(() => exports);
  const queryComponent = rstest.fn(
    (
      _source: string,
      callback: Parameters<NativeApp['queryComponent']>[1],
    ) => {
      callback({ code: 0, detail: { schema: 'shared.bundle' } });
    },
  );
  const nativeApp = {
    i18nResource: { data: undefined },
    queryComponent,
    tt: {},
  } as unknown as NativeApp;
  const rpc = {
    createCall: () => rstest.fn(),
  } as unknown as Rpc;
  const lynx = createBackgroundLynx(
    {},
    {},
    nativeApp,
    rpc,
    loadDynamicComponent,
  );

  const first = lynx.loadLazyBundle('shared.bundle');
  const second = lynx.loadLazyBundle('shared.bundle');

  await expect(Promise.all([first, second])).resolves.toEqual([
    exports,
    exports,
  ]);
  expect(queryComponent).toHaveBeenCalledTimes(1);
  expect(loadDynamicComponent).toHaveBeenCalledWith(
    nativeApp.tt,
    'shared.bundle',
  );
});

test('background lynx retries a lazy bundle after Lynx Core throws', async () => {
  const exports = { ids: ['shared'], modules: {} };
  const loadDynamicComponent = rstest.fn()
    .mockImplementationOnce(() => {
      throw new Error('load failed');
    })
    .mockReturnValue(exports);
  const queryComponent = rstest.fn(
    (
      _source: string,
      callback: Parameters<NativeApp['queryComponent']>[1],
    ) => {
      queueMicrotask(() => {
        callback({ code: 0, detail: { schema: 'shared.bundle' } });
      });
    },
  );
  const nativeApp = {
    i18nResource: { data: undefined },
    queryComponent,
    tt: {},
  } as unknown as NativeApp;
  const rpc = {
    createCall: () => rstest.fn(),
  } as unknown as Rpc;
  const lynx = createBackgroundLynx(
    {},
    {},
    nativeApp,
    rpc,
    loadDynamicComponent,
  );

  await expect(lynx.loadLazyBundle('shared.bundle')).rejects.toThrow(
    'load failed',
  );
  await expect(lynx.loadLazyBundle('shared.bundle')).resolves.toBe(exports);
  expect(queryComponent).toHaveBeenCalledTimes(2);
});

test('bundle execution selects its source URL by bundle kind', () => {
  const originalXMLHttpRequest = globalThis.XMLHttpRequest;
  class FakeXMLHttpRequest {
    status = 200;
    responseText =
      'module.exports = [globalThis.location.href, globalThis.self === globalThis];';
    open() {}
    send() {}
  }
  globalThis.XMLHttpRequest =
    FakeXMLHttpRequest as unknown as typeof XMLHttpRequest;

  try {
    const componentURL = 'https://cdn.example.com/components/card.web.bundle';
    const externalURL = 'https://cdn.example.com/remotes/catalog.web.bundle';
    const { loadScript, markExternalBundle, templateCache } =
      createChunkLoading('app.web.bundle', 'react');
    templateCache.set(componentURL, { '/root': 'blob:card' });
    templateCache.set(externalURL, { '/catalog': 'blob:catalog' });
    markExternalBundle(externalURL);
    const componentScript = loadScript('root', componentURL);
    const externalScript = loadScript('catalog', externalURL);

    expect(
      componentScript.init(
        { tt: {} } as Parameters<typeof componentScript.init>[0],
      ),
    ).toEqual([`${componentURL}/root`, true]);
    expect(
      externalScript.init(
        { tt: {} } as Parameters<typeof externalScript.init>[0],
      ),
    ).toEqual([externalURL, true]);
  } finally {
    globalThis.XMLHttpRequest = originalXMLHttpRequest;
  }
});

test('external bundle execution preserves global method receivers', () => {
  const originalXMLHttpRequest = globalThis.XMLHttpRequest;
  const methodName = '__lynxReceiverSensitiveMethod__';
  const originalMethod = Object.getOwnPropertyDescriptor(
    globalThis,
    methodName,
  );
  Object.defineProperty(globalThis, methodName, {
    configurable: true,
    value: function(this: typeof globalThis) {
      if (this !== globalThis) {
        throw new TypeError('Illegal invocation');
      }
      return 'receiver-ok';
    },
  });
  class FakeXMLHttpRequest {
    status = 200;
    responseText = `module.exports = [
      globalThis.${methodName}(),
      globalThis.self.${methodName}(),
      globalThis.${methodName} === globalThis.${methodName},
    ];`;
    open() {}
    send() {}
  }
  globalThis.XMLHttpRequest =
    FakeXMLHttpRequest as unknown as typeof XMLHttpRequest;

  try {
    const bundleURL = 'https://cdn.example.com/remotes/catalog.web.bundle';
    const { loadScript, markExternalBundle, templateCache } =
      createChunkLoading('app.web.bundle', 'react');
    templateCache.set(bundleURL, { '/catalog': 'blob:catalog' });
    markExternalBundle(bundleURL);
    const script = loadScript('catalog', bundleURL);

    expect(
      script.init({ tt: {} } as Parameters<typeof script.init>[0]),
    ).toEqual(['receiver-ok', 'receiver-ok', true]);
  } finally {
    globalThis.XMLHttpRequest = originalXMLHttpRequest;
    if (originalMethod === undefined) {
      Reflect.deleteProperty(globalThis, methodName);
    } else {
      Object.defineProperty(globalThis, methodName, originalMethod);
    }
  }
});
