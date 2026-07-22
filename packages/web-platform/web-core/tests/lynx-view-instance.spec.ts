/*
 * Copyright 2026 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

import './jsdom.js';
import { afterEach, expect, rstest, test } from '@rstest/core';

import { LynxViewInstance } from '../ts/client/mainthread/LynxViewInstance.js';
import type { LynxViewElement } from '../ts/client/mainthread/LynxView.js';
import { templateManager } from '../ts/client/mainthread/TemplateManager.js';
import type { JSRealm } from '../ts/types/index.js';

const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;

afterEach(() => {
  rstest.restoreAllMocks();
  if (originalRequestAnimationFrame) {
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
  } else {
    Reflect.deleteProperty(globalThis, 'requestAnimationFrame');
  }
  if (originalCancelAnimationFrame) {
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
  } else {
    Reflect.deleteProperty(globalThis, 'cancelAnimationFrame');
  }
});

function createInstance(loadScript: JSRealm['loadScript']) {
  const parentDom = document.createElement('div') as LynxViewElement;
  const rootDom = parentDom.attachShadow({ mode: 'open' });
  const globalWindow = {} as typeof globalThis;
  globalThis.requestAnimationFrame ??= rstest.fn();
  globalThis.cancelAnimationFrame ??= rstest.fn();
  const instance = new LynxViewInstance(
    parentDom,
    {},
    {},
    'app.web.bundle',
    rootDom,
    { globalWindow, loadScript, loadScriptSync: rstest.fn() },
    false,
    undefined,
  );
  instance.onPageConfigReady({});
  return instance;
}

function mockBundleFetch() {
  let active = false;
  return rstest.spyOn(templateManager, 'fetchBundle')
    .mockImplementation(async (url, instancePromise, ...args) => {
      expect(active).toBe(false);
      active = true;
      await Promise.resolve();
      const overrideConfig = args.at(-1);
      if (overrideConfig?.isExternalBundle !== 'true') {
        (await instancePromise).lepusCodeUrls.set(url, { root: 'blob:root' });
      }
      active = false;
    });
}

test('a lazy load followed by an external load keeps both results', async () => {
  const exports = { ids: ['catalog'], modules: {} };
  const instance = createInstance(rstest.fn(async () => exports));
  const fetchBundle = mockBundleFetch();
  const url = 'https://cdn.example.com/catalog.web.bundle';

  await expect(Promise.all([
    instance.queryComponent(url),
    instance.loadExternalBundle(url),
  ])).resolves.toEqual([
    exports,
    { url, code: 0, errorMsg: '' },
  ]);

  expect(fetchBundle).toHaveBeenCalledTimes(2);
});

test('an external load followed by a lazy load keeps both results', async () => {
  const exports = { ids: ['catalog'], modules: {} };
  const instance = createInstance(rstest.fn(async () => exports));
  const fetchBundle = mockBundleFetch();
  const url = 'https://cdn.example.com/catalog.web.bundle';

  await expect(Promise.all([
    instance.loadExternalBundle(url),
    instance.queryComponent(url),
  ])).resolves.toEqual([
    { url, code: 0, errorMsg: '' },
    exports,
  ]);

  expect(fetchBundle).toHaveBeenCalledTimes(2);
});

test('a rejected lazy load can be retried', async () => {
  const exports = { ids: ['catalog'], modules: {} };
  const instance = createInstance(rstest.fn(async () => exports));
  const fetchBundle = rstest.spyOn(templateManager, 'fetchBundle')
    .mockRejectedValueOnce(new Error('transient failure'))
    .mockImplementationOnce(async (url, instancePromise) => {
      (await instancePromise).lepusCodeUrls.set(url, { root: 'blob:root' });
    });
  const url = 'https://cdn.example.com/catalog.web.bundle';

  await expect(instance.queryComponent(url)).rejects.toThrow(
    'transient failure',
  );
  await expect(instance.queryComponent(url)).resolves.toBe(exports);

  expect(fetchBundle).toHaveBeenCalledTimes(2);
});

test('a rejected external load can be retried', async () => {
  const instance = createInstance(rstest.fn());
  const fetchBundle = rstest.spyOn(templateManager, 'fetchBundle')
    .mockRejectedValueOnce(new Error('transient failure'))
    .mockResolvedValueOnce();
  const url = 'https://cdn.example.com/catalog.web.bundle';

  await expect(instance.loadExternalBundle(url)).resolves.toEqual({
    url,
    code: -1,
    errorMsg: 'transient failure',
  });
  await expect(instance.loadExternalBundle(url)).resolves.toEqual({
    url,
    code: 0,
    errorMsg: '',
  });

  expect(fetchBundle).toHaveBeenCalledTimes(2);
});
