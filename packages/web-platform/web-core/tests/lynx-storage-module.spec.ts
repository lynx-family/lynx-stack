// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { beforeEach, describe, expect, rstest, test } from '@rstest/core';
import type { Rpc } from '@lynx-js/web-worker-rpc';
import type { Cloneable } from '../ts/types/index.js';
import { nativeModulesCallEndpoint } from '../ts/client/endpoints.js';
import { createNativeModules } from '../ts/client/background/background-apis/createNativeModules.js';
import { registerNativeModulesCallHandler } from '../ts/client/mainthread/crossThreadHandlers/registerNativeModulesCallHandler.js';
import type { LynxViewInstance } from '../ts/client/mainthread/LynxViewInstance.js';
import './jsdom.js';

type NativeModulesCall = (
  name: string,
  data: Cloneable,
  moduleName: string,
) => Promise<unknown>;

type NativeModulesHandler = (
  name: string,
  data: Cloneable,
  moduleName: string,
) => unknown;

function createCallingRpc(nativeModulesCall: NativeModulesCall): Rpc {
  return {
    createCall: rstest.fn((endpoint: { name: string }) => {
      return endpoint.name === nativeModulesCallEndpoint.name
        ? nativeModulesCall
        : rstest.fn();
    }),
  } as unknown as Rpc;
}

function createHandlingRpc(): {
  rpc: Rpc;
  getHandler: () => NativeModulesHandler;
} {
  let handler: NativeModulesHandler | undefined;
  const rpc = {
    registerHandler: rstest.fn((
      endpoint: { name: string },
      registeredHandler: NativeModulesHandler,
    ) => {
      if (endpoint.name === nativeModulesCallEndpoint.name) {
        handler = registeredHandler;
      }
    }),
  } as unknown as Rpc;

  return {
    rpc,
    getHandler() {
      if (!handler) {
        throw new Error('NativeModules handler was not registered');
      }
      return handler;
    },
  };
}

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: window.localStorage,
});

describe('LynxStorageModule BTS facade', () => {
  test('exposes Promise storage methods over nativeModulesCallEndpoint', async () => {
    const nativeModulesCall = rstest.fn<NativeModulesCall>(
      async (name) => ({
        ok: true,
        value: name === 'getItem'
          ? 'stored-value'
          : name === 'getAllKeys'
          ? ['stored-key']
          : undefined,
      }),
    );
    const rpc = createCallingRpc(nativeModulesCall);
    const nativeModules = await createNativeModules(rpc, rpc, {});
    const storage = nativeModules.LynxStorageModule;

    expect(storage).toBeDefined();
    await expect(storage.setItem('stored-key', 'stored-value')).resolves
      .toBeUndefined();
    await expect(storage.getItem('stored-key')).resolves.toBe('stored-value');
    await expect(storage.removeItem('stored-key')).resolves.toBeUndefined();
    await expect(storage.getAllKeys()).resolves.toEqual(['stored-key']);

    expect(nativeModulesCall).toHaveBeenNthCalledWith(
      1,
      'setItem',
      { key: 'stored-key', value: 'stored-value' },
      'LynxStorageModule',
    );
    expect(nativeModulesCall).toHaveBeenNthCalledWith(
      2,
      'getItem',
      { key: 'stored-key' },
      'LynxStorageModule',
    );
    expect(nativeModulesCall).toHaveBeenNthCalledWith(
      3,
      'removeItem',
      { key: 'stored-key' },
      'LynxStorageModule',
    );
    expect(nativeModulesCall).toHaveBeenNthCalledWith(
      4,
      'getAllKeys',
      {},
      'LynxStorageModule',
    );
  });

  test('reconstructs browser storage errors returned by the main thread', async () => {
    const nativeModulesCall = rstest.fn<NativeModulesCall>(async () => ({
      ok: false,
      error: {
        name: 'QuotaExceededError',
        message: 'Storage quota exceeded',
      },
    }));
    const rpc = createCallingRpc(nativeModulesCall);
    const nativeModules = await createNativeModules(rpc, rpc, {});

    await expect(
      nativeModules.LynxStorageModule.setItem('key', 'value'),
    ).rejects.toMatchObject({
      name: 'QuotaExceededError',
      message: 'Storage quota exceeded',
    });
  });

  test('does not load a custom module with the reserved storage name', async () => {
    const rpc = createCallingRpc(rstest.fn<NativeModulesCall>());
    const nativeModules = await createNativeModules(rpc, rpc, {
      LynxStorageModule: 'invalid:reserved-module',
    });

    expect(nativeModules.LynxStorageModule.getItem).toBeTypeOf('function');
  });
});

describe('LynxStorageModule main-thread handler', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('reads and mutates raw same-origin localStorage', () => {
    const hostCall = rstest.fn();
    const { rpc, getHandler } = createHandlingRpc();
    registerNativeModulesCallHandler(rpc, {
      parentDom: { onNativeModulesCall: hostCall },
    } as unknown as LynxViewInstance);
    const handler = getHandler();

    localStorage.setItem('host-key', 'host-value');
    expect(
      handler(
        'setItem',
        { key: 'lynx-key', value: 'lynx-value' },
        'LynxStorageModule',
      ),
    ).toEqual({ ok: true, value: undefined });
    expect(localStorage.getItem('lynx-key')).toBe('lynx-value');
    expect(
      handler('getItem', { key: 'host-key' }, 'LynxStorageModule'),
    ).toEqual({ ok: true, value: 'host-value' });
    expect(
      handler('getItem', { key: 'missing-key' }, 'LynxStorageModule'),
    ).toEqual({ ok: true, value: null });
    const allKeysResult = handler('getAllKeys', {}, 'LynxStorageModule') as {
      ok: true;
      value: string[];
    };
    expect(allKeysResult.ok).toBe(true);
    expect(new Set(allKeysResult.value)).toEqual(
      new Set(['host-key', 'lynx-key']),
    );
    expect(
      handler('removeItem', { key: 'lynx-key' }, 'LynxStorageModule'),
    ).toEqual({ ok: true, value: undefined });
    expect(localStorage.getItem('lynx-key')).toBeNull();
    expect(hostCall).not.toHaveBeenCalled();
  });

  test('returns browser errors as cloneable data', () => {
    const { rpc, getHandler } = createHandlingRpc();
    registerNativeModulesCallHandler(rpc, {
      parentDom: {},
    } as unknown as LynxViewInstance);
    const handler = getHandler();
    const setItem = rstest.spyOn(window.Storage.prototype, 'setItem')
      .mockImplementationOnce(() => {
        throw {
          name: 'QuotaExceededError',
          message: 'Storage quota exceeded',
        };
      });

    expect(
      handler(
        'setItem',
        { key: 'lynx-key', value: 'lynx-value' },
        'LynxStorageModule',
      ),
    ).toEqual({
      ok: false,
      error: {
        name: 'QuotaExceededError',
        message: 'Storage quota exceeded',
      },
    });
    setItem.mockRestore();
  });

  test('returns errors thrown while accessing localStorage', () => {
    const { rpc, getHandler } = createHandlingRpc();
    registerNativeModulesCallHandler(rpc, {
      parentDom: {},
    } as unknown as LynxViewInstance);
    const error = new Error('Storage access denied');
    error.name = 'SecurityError';
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw error;
      },
    });

    try {
      expect(
        getHandler()('getItem', { key: 'key' }, 'LynxStorageModule'),
      ).toEqual({
        ok: false,
        error: {
          name: 'SecurityError',
          message: 'Storage access denied',
        },
      });
    } finally {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: window.localStorage,
      });
    }
  });

  test('does not expose unsupported storage methods', () => {
    const { rpc, getHandler } = createHandlingRpc();
    registerNativeModulesCallHandler(rpc, {
      parentDom: {},
    } as unknown as LynxViewInstance);

    expect(getHandler()('clear', {}, 'LynxStorageModule')).toEqual({
      ok: false,
      error: {
        name: 'TypeError',
        message: 'Unsupported LynxStorageModule method: clear',
      },
    });
  });

  test('keeps delegating non-storage modules to the host callback', () => {
    const hostCall = rstest.fn(() => ({ host: true }));
    const { rpc, getHandler } = createHandlingRpc();
    registerNativeModulesCallHandler(rpc, {
      parentDom: { onNativeModulesCall: hostCall },
    } as unknown as LynxViewInstance);

    const data = { value: 'payload' };
    expect(getHandler()('customMethod', data, 'CustomModule')).toEqual({
      host: true,
    });
    expect(hostCall).toHaveBeenCalledWith(
      'customMethod',
      data,
      'CustomModule',
    );
  });
});
