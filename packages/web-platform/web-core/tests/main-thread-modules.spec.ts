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
import { LynxViewElement } from '../ts/client/mainthread/LynxView.js';
import { createMainThreadGlobalAPIs } from '../ts/client/mainthread/createMainThreadGlobalAPIs.js';
import type { LynxViewInstance } from '../ts/client/mainthread/LynxViewInstance.js';
import { createServerLynx } from '../ts/server/createServerLynx.js';

rstest.mock('../ts/client/mainthread/TemplateManager.js', () => ({
  templateManager: { fetchBundle: rstest.fn() },
}));

function createLynx(view: LynxViewElement) {
  return createMainThreadGlobalAPIs({
    parentDom: view,
    globalprops: {},
    systemInfo: {},
    backgroundThread: { markTiming: rstest.fn() },
    i18nManager: { _I18nResourceTranslation: rstest.fn() },
  } as unknown as LynxViewInstance).lynx;
}

describe('main-thread lynx.module', () => {
  beforeEach(() => {
    rstest.stubGlobal('cancelAnimationFrame', rstest.fn());
  });

  afterEach(() => {
    rstest.unstubAllGlobals();
  });

  test('returns undefined when the map or requested module is missing', () => {
    const view = new LynxViewElement();
    const lynx = createLynx(view);
    expect(lynx.module('DeviceInfo')).toBeUndefined();
    view.mainThreadModules = {};
    expect(lynx.module('DeviceInfo')).toBeUndefined();
  });

  test('exposes the host module with synchronous results and errors', () => {
    const view = new LynxViewElement();
    const module = {
      value: 'stored value',
      invoke(method: string, key: unknown) {
        if (method === 'get' && key === 'key') return this.value;
        throw new Error('Unsupported method');
      },
    };
    view.mainThreadModules = { Storage: module };
    const lynx = createLynx(view);
    expect(lynx.module('Storage')).toBe(module);
    expect(lynx.module('Storage')?.invoke('get', 'key')).toBe('stored value');
    expect(() => lynx.module('Storage')?.invoke('set', 'key')).toThrow(
      'Unsupported method',
    );
  });

  test('reads the current map after registration, replacement and removal', () => {
    const view = new LynxViewElement();
    const lynx = createLynx(view);
    const first = { invoke: () => 'first' };
    const second = { invoke: () => 'second' };
    view.mainThreadModules = { Storage: first };
    expect(lynx.module('Storage')).toBe(first);
    view.mainThreadModules.Storage = second;
    expect(lynx.module('Storage')).toBe(second);
    view.mainThreadModules = { Storage: first };
    expect(lynx.module('Storage')).toBe(first);
    delete view.mainThreadModules.Storage;
    expect(lynx.module('Storage')).toBeUndefined();
    view.mainThreadModules = undefined;
    expect(lynx.module('Storage')).toBeUndefined();
  });

  test('isolates modules between views and from background module URLs', () => {
    const firstView = new LynxViewElement();
    const secondView = new LynxViewElement();
    firstView.mainThreadModules = { Storage: { invoke: () => 'first' } };
    secondView.mainThreadModules = { Storage: { invoke: () => 'second' } };
    secondView.nativeModulesMap = { BackgroundOnly: '/storage.js' };
    expect(createLynx(firstView).module('Storage')?.invoke('get')).toBe(
      'first',
    );
    expect(createLynx(secondView).module('Storage')?.invoke('get')).toBe(
      'second',
    );
    expect(createLynx(secondView).module('BackgroundOnly')).toBeUndefined();
  });

  test('returns undefined during server rendering without a host view', () => {
    expect(createServerLynx({}, {}).module('Storage')).toBeUndefined();
  });
});
