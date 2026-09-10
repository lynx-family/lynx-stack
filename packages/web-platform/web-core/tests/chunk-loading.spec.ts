/*
 * Copyright 2026 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

import './jsdom.js';
import { describe, expect, rstest, test } from '@rstest/core';
import type { Rpc } from '@lynx-js/web-worker-rpc';

import { createBackgroundLynx } from '../ts/client/background/background-apis/createBackgroundLynx.js';
import { createChunkLoading } from '../ts/client/background/background-apis/createChunkLoading.js';
import { createQueryComponent } from '../ts/client/background/background-apis/createQueryComponent.js';
import { getExecutionSourceURL } from '../ts/client/executionSourceURL.js';
import type { BundleInitReturnObj, NativeTTObject } from '../ts/types/index.js';
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

test('QueryComponent shares an in-flight request', async () => {
  type Result = Parameters<Parameters<NativeApp['queryComponent']>[1]>[0];
  let resolveQuery!: (result: Result) => void;
  const query = rstest.fn(
    () =>
      new Promise<Result>(resolve => {
        resolveQuery = resolve;
      }),
  );
  const queryComponent = createQueryComponent(query);
  const first = rstest.fn();
  const second = rstest.fn();

  queryComponent('shared.bundle', first);
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

test('background lynx shares an in-flight FetchBundle load', async () => {
  const exports = { ids: ['shared'], modules: {} };
  const fetchBundle = rstest.fn(async (source: string) => ({
    code: 0,
    errorMsg: '',
    url: source,
  }));
  const loadScript = rstest.fn(() => exports);
  const nativeApp = {
    callLepusMethod: (
      _name: string,
      _data: unknown,
      callback: (result: unknown) => void,
    ) => callback(undefined),
    i18nResource: { data: undefined },
    tt: { lynx: { loadScript } },
  } as unknown as NativeApp;
  const rpc = {
    createCall: () => fetchBundle,
  } as unknown as Rpc;
  const lynx = createBackgroundLynx({}, {}, nativeApp, rpc);

  const first = lynx.loadLazyBundle('shared.bundle');
  const second = lynx.loadLazyBundle('shared.bundle');

  await expect(Promise.all([first, second])).resolves.toEqual([
    exports,
    exports,
  ]);
  expect(fetchBundle).toHaveBeenCalledTimes(1);
  expect(loadScript).toHaveBeenCalledTimes(1);
});

test('background lynx loads FetchBundle sections before the app entry', async () => {
  const exports = { ids: ['shared'], modules: {} };
  const fetchBundle = rstest.fn(async (source: string) => ({
    code: 0,
    errorMsg: '',
    url: source,
  }));
  const loadScript = rstest.fn(() => exports);
  const callLepusMethod = rstest.fn(
    (
      _name: string,
      _data: unknown,
      callback: (result: unknown) => void,
    ) => callback(undefined),
  );
  const queryComponent = rstest.fn();
  const nativeApp = {
    callLepusMethod,
    i18nResource: { data: undefined },
    queryComponent,
    tt: { lynx: { loadScript } },
  } as unknown as NativeApp;
  const rpc = {
    createCall: () => fetchBundle,
  } as unknown as Rpc;
  const lynx = createBackgroundLynx({}, {}, nativeApp, rpc);

  await expect(
    (lynx.loadLazyBundle as (
      source: string,
      mode?: string,
      host?: string,
    ) => Promise<unknown>)('shared.bundle', undefined, 'remote-host'),
  ).resolves.toBe(exports);
  expect(fetchBundle).toHaveBeenCalledWith('shared.bundle', {
    isLazyBundle: true,
  });
  expect(loadScript).toHaveBeenCalledWith('background', {
    bundleName: 'shared.bundle',
  });
  expect(callLepusMethod).toHaveBeenCalledWith(
    'rLynxPrepareLazyBundleMTS',
    { url: 'shared.bundle', host: 'remote-host' },
    expect.any(Function),
  );
  expect(queryComponent).not.toHaveBeenCalled();
});

test('background lynx retries a lazy bundle after section execution throws', async () => {
  const exports = { ids: ['shared'], modules: {} };
  const fetchBundle = rstest.fn(async (source: string) => ({
    code: 0,
    errorMsg: '',
    url: source,
  }));
  const loadScript = rstest.fn()
    .mockImplementationOnce(() => {
      throw new Error('load failed');
    })
    .mockReturnValue(exports);
  const nativeApp = {
    callLepusMethod: (
      _name: string,
      _data: unknown,
      callback: (result: unknown) => void,
    ) => callback(undefined),
    i18nResource: { data: undefined },
    tt: { lynx: { loadScript } },
  } as unknown as NativeApp;
  const rpc = {
    createCall: () => fetchBundle,
  } as unknown as Rpc;
  const lynx = createBackgroundLynx({}, {}, nativeApp, rpc);

  await expect(lynx.loadLazyBundle('shared.bundle')).rejects.toThrow(
    'load failed',
  );
  await expect(lynx.loadLazyBundle('shared.bundle')).resolves.toBe(exports);
  expect(fetchBundle).toHaveBeenCalledTimes(2);
  expect(loadScript).toHaveBeenCalledTimes(2);
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

const bundleSource = `
  module.exports = {
    lexicalConsole: console,
    workerConsole: globalThis.console,
  };
`;

function createTT(
  NativeModules: Record<string, unknown>,
  sharedConsole?: unknown,
): NativeTTObject {
  return {
    NativeModules,
    sharedConsole,
  } as unknown as NativeTTObject;
}

function loadSyncBundle(source: string): BundleInitReturnObj {
  const descriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'XMLHttpRequest',
  );

  Object.defineProperty(globalThis, 'XMLHttpRequest', {
    configurable: true,
    value: class {
      responseText = source;
      status = 200;

      open() {}
      send() {}
    },
  });

  try {
    return createChunkLoading('/main.web.bundle', 'react').loadScript(
      'app-service.js',
    );
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, 'XMLHttpRequest', descriptor);
    } else {
      delete (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest;
    }
  }
}

async function loadAsyncBundle(source: string): Promise<BundleInitReturnObj> {
  const fetch = globalThis.fetch;
  globalThis.fetch = rstest.fn(() =>
    Promise.resolve({
      ok: true,
      text: () => Promise.resolve(source),
    } as Response)
  );

  try {
    return await new Promise((resolve, reject) => {
      createChunkLoading('/main.web.bundle', 'react').loadScriptAsync(
        'async-chunk.js',
        (message, bundle) => {
          if (message || !bundle) {
            reject(new Error(message ?? 'Bundle was not loaded'));
          } else {
            resolve(bundle);
          }
        },
      );
    });
  } finally {
    globalThis.fetch = fetch;
  }
}

type BundleExports = {
  lexicalConsole: unknown;
  workerConsole: unknown;
};

describe('createChunkLoading', () => {
  test('injects a view-scoped console without changing the Worker console', () => {
    const bundle = loadSyncBundle(bundleSource);
    const pageAConsole = { log: rstest.fn() };
    const pageBConsole = { log: rstest.fn() };
    const sharedConsole = { log: rstest.fn() };

    const pageAExports = bundle.init({
      tt: createTT({ LynxConsoleModule: pageAConsole }, sharedConsole),
    }) as BundleExports;
    const pageBExports = bundle.init({
      tt: createTT({ LynxConsoleModule: pageBConsole }, sharedConsole),
    }) as BundleExports;

    expect(pageAExports.lexicalConsole).toBe(pageAConsole);
    expect(pageBExports.lexicalConsole).toBe(pageBConsole);
    expect(pageAExports.workerConsole).toBe(globalThis.console);
    expect(pageBExports.workerConsole).toBe(globalThis.console);
  });

  test('falls back to the shared console and then the Worker console', () => {
    const bundle = loadSyncBundle(bundleSource);
    const sharedConsole = { log: rstest.fn() };

    const sharedConsoleExports = bundle.init({
      tt: createTT({}, sharedConsole),
    }) as BundleExports;
    const workerConsoleExports = bundle.init({
      tt: createTT({}),
    }) as BundleExports;

    expect(sharedConsoleExports.lexicalConsole).toBe(sharedConsole);
    expect(workerConsoleExports.lexicalConsole).toBe(globalThis.console);
  });

  test('injects the view-scoped console into asynchronously loaded chunks', async () => {
    const bundle = await loadAsyncBundle(bundleSource);
    const viewConsole = { log: rstest.fn() };

    const exports = bundle.init({
      tt: createTT({ LynxConsoleModule: viewConsole }),
    }) as BundleExports;

    expect(exports.lexicalConsole).toBe(viewConsole);
    expect(exports.workerConsole).toBe(globalThis.console);
  });
});
