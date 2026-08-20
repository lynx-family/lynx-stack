// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, describe, expect, rstest, test } from '@rstest/core';
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

function setBrowserClipboard(clipboard: Partial<Clipboard> | undefined): void {
  Object.defineProperty(globalThis.window.navigator, 'clipboard', {
    configurable: true,
    value: clipboard,
  });
}

afterEach(() => {
  setBrowserClipboard(undefined);
});

describe('LynxClipboardModule BTS facade', () => {
  test('exposes Promise clipboard methods over nativeModulesCallEndpoint', async () => {
    const nativeModulesCall = rstest.fn<NativeModulesCall>(
      async (name) => ({
        ok: true,
        value: name === 'readText' ? 'clipboard text' : undefined,
      }),
    );
    const rpc = createCallingRpc(nativeModulesCall);
    const nativeModules = await createNativeModules(rpc, rpc, {});
    const clipboard = nativeModules.LynxClipboardModule;

    expect(clipboard).toBeDefined();
    await expect(clipboard.writeText('new text')).resolves.toBeUndefined();
    await expect(clipboard.readText()).resolves.toBe('clipboard text');

    expect(nativeModulesCall).toHaveBeenNthCalledWith(
      1,
      'writeText',
      { text: 'new text' },
      'LynxClipboardModule',
    );
    expect(nativeModulesCall).toHaveBeenNthCalledWith(
      2,
      'readText',
      {},
      'LynxClipboardModule',
    );
  });

  test('reconstructs browser clipboard errors returned by the main thread', async () => {
    const nativeModulesCall = rstest.fn<NativeModulesCall>(async () => ({
      ok: false,
      error: {
        name: 'NotAllowedError',
        message: 'Clipboard permission denied',
      },
    }));
    const rpc = createCallingRpc(nativeModulesCall);
    const nativeModules = await createNativeModules(rpc, rpc, {});

    await expect(nativeModules.LynxClipboardModule.readText()).rejects
      .toMatchObject({
        name: 'NotAllowedError',
        message: 'Clipboard permission denied',
      });
  });

  test('does not load a custom module with the reserved clipboard name', async () => {
    const rpc = createCallingRpc(rstest.fn<NativeModulesCall>());
    const nativeModules = await createNativeModules(rpc, rpc, {
      LynxClipboardModule: 'invalid:reserved-module',
    });

    expect(nativeModules.LynxClipboardModule.readText).toBeTypeOf('function');
  });
});

describe('LynxClipboardModule main-thread handler', () => {
  test('reads and writes text through the browser Clipboard API', async () => {
    const readText = rstest.fn(async () => 'browser clipboard text');
    const writeText = rstest.fn(async () => undefined);
    setBrowserClipboard({ readText, writeText });
    const hostCall = rstest.fn();
    const { rpc, getHandler } = createHandlingRpc();
    registerNativeModulesCallHandler(rpc, {
      parentDom: { onNativeModulesCall: hostCall },
    } as unknown as LynxViewInstance);
    const handler = getHandler();

    await expect(
      handler('writeText', { text: 'new text' }, 'LynxClipboardModule'),
    ).resolves.toEqual({ ok: true, value: undefined });
    expect(writeText).toHaveBeenCalledWith('new text');
    await expect(
      handler('readText', {}, 'LynxClipboardModule'),
    ).resolves.toEqual({ ok: true, value: 'browser clipboard text' });
    expect(readText).toHaveBeenCalledTimes(1);
    expect(hostCall).not.toHaveBeenCalled();
  });

  test('returns browser errors as cloneable data', async () => {
    const error = new Error('Clipboard permission denied');
    error.name = 'NotAllowedError';
    setBrowserClipboard({
      readText: rstest.fn(async () => {
        throw error;
      }),
    });
    const { rpc, getHandler } = createHandlingRpc();
    registerNativeModulesCallHandler(rpc, {
      parentDom: {},
    } as unknown as LynxViewInstance);

    await expect(
      getHandler()('readText', {}, 'LynxClipboardModule'),
    ).resolves.toEqual({
      ok: false,
      error: {
        name: 'NotAllowedError',
        message: 'Clipboard permission denied',
      },
    });
  });

  test('reports when the browser Clipboard API is unavailable', async () => {
    setBrowserClipboard(undefined);
    const { rpc, getHandler } = createHandlingRpc();
    registerNativeModulesCallHandler(rpc, {
      parentDom: {},
    } as unknown as LynxViewInstance);

    await expect(
      getHandler()('readText', {}, 'LynxClipboardModule'),
    ).resolves.toEqual({
      ok: false,
      error: {
        name: 'Error',
        message: 'The browser Clipboard API is unavailable.',
      },
    });
  });

  test('does not expose unsupported clipboard methods', async () => {
    setBrowserClipboard({
      readText: rstest.fn(),
      writeText: rstest.fn(),
    });
    const { rpc, getHandler } = createHandlingRpc();
    registerNativeModulesCallHandler(rpc, {
      parentDom: {},
    } as unknown as LynxViewInstance);

    await expect(
      getHandler()('read', {}, 'LynxClipboardModule'),
    ).resolves.toEqual({
      ok: false,
      error: {
        name: 'TypeError',
        message: 'Unsupported LynxClipboardModule method: read',
      },
    });
  });
});
