// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import './jsdom.js';
import { beforeEach, describe, expect, rstest, test } from '@rstest/core';
import type { Rpc, RpcCallType } from '@lynx-js/web-worker-rpc';
import { ErrorCode, IdentifierType } from '../ts/constants.js';
import type { FieldsCallbackRes } from '../ts/types/index.js';
import { getFieldsEndpoint } from '../ts/client/endpoints.js';
import { createGetFields } from '../ts/client/background/background-apis/crossThreadHandlers/createGetFields.js';
import { registerGetFieldsHandler } from '../ts/client/mainthread/crossThreadHandlers/registerGetFieldsHandler.js';
import { createElementAPI } from '../ts/client/mainthread/elementAPIs/createElementAPI.js';
import { WASMJSBinding } from '../ts/client/mainthread/elementAPIs/WASMJSBinding.js';
import type { LynxViewInstance } from '../ts/client/mainthread/LynxViewInstance.js';
import { createTestLynxViewInstance } from './createTestLynxViewInstance.js';

type GetFieldsHandler = (
  ...args: Parameters<RpcCallType<typeof getFieldsEndpoint>>
) => FieldsCallbackRes;

describe('getFields', () => {
  let handler: GetFieldsHandler;
  let apis: ReturnType<typeof createElementAPI>;
  let target: HTMLElement;
  let root: HTMLElement;

  beforeEach(() => {
    const rootDom = document.createElement('div').attachShadow({
      mode: 'open',
    });
    const binding = new WASMJSBinding(createTestLynxViewInstance(rootDom));
    apis = createElementAPI(rootDom, binding, true, true, true);
    root = apis.__CreatePage('page', 0);
    target = apis.__CreateElement('text', 0);
    apis.__SetID(target, 'target');
    apis.__SetDataset(target, {
      hello: 'world',
      count: 0,
      enabled: false,
      detail: { answer: 42 },
    });
    apis.__AppendElement(root, target);
    apis.__FlushElementTree();
    registerGetFieldsHandler({
      registerHandler: (endpoint: unknown, callback: GetFieldsHandler) => {
        expect(endpoint).toBe(getFieldsEndpoint);
        handler = callback;
      },
    } as Rpc, {
      rootDom,
      mtsWasmBinding: binding,
      mainThreadGlobalThis: apis,
    } as unknown as LynxViewInstance);
  });

  function query(identifier: string, fields: string[], firstOnly = true) {
    return handler(
      IdentifierType.ID_SELECTOR,
      identifier,
      '',
      firstOnly,
      fields,
      undefined,
    );
  }

  test('returns Lynx tags and typed datasets with the callback status', () => {
    expect(query('#target', ['id', 'dataset', 'tag'])).toEqual({
      data: {
        id: 'target',
        dataset: {
          hello: 'world',
          count: 0,
          enabled: false,
          detail: { answer: 42 },
        },
        tag: 'text',
      },
      status: { code: ErrorCode.SUCCESS, data: 'success' },
    });
  });

  test('only returns requested supported fields', () => {
    expect(query('#target', ['id', 'unknown']).data).toEqual({ id: 'target' });
    expect(query('#target', []).data).toEqual({});
  });

  test('returns every selected node in document order, including empty metadata', () => {
    const second = apis.__CreateElement('text', 0);
    apis.__AppendElement(root, second);
    expect(query('x-text', ['id', 'dataset', 'tag'], false)).toEqual({
      data: [
        {
          id: 'target',
          dataset: {
            hello: 'world',
            count: 0,
            enabled: false,
            detail: { answer: 42 },
          },
          tag: 'text',
        },
        { id: '', dataset: {}, tag: 'text' },
      ],
      status: { code: ErrorCode.SUCCESS, data: 'success' },
    });
  });

  test('returns null or an empty array when no nodes match', () => {
    expect(query('#missing', ['id'])).toEqual({
      data: null,
      status: { code: ErrorCode.NODE_NOT_FOUND, data: 'node not found' },
    });
    expect(query('#missing', ['id'], false)).toEqual({
      data: [],
      status: { code: ErrorCode.SUCCESS, data: 'success' },
    });
  });

  test('supports unique IDs and scoped queries', () => {
    expect(
      handler(
        IdentifierType.UNIQUE_ID,
        String(apis.__GetElementUniqueID(target)),
        '',
        true,
        ['tag'],
        undefined,
      ).data,
    )
      .toEqual({ tag: 'text' });
    expect(
      handler(
        IdentifierType.ID_SELECTOR,
        '#target',
        '',
        true,
        ['id'],
        apis.__GetElementUniqueID(root),
      ).data,
    )
      .toEqual({ id: 'target' });
  });

  test('reports unsupported selectors', () => {
    expect(query('[', ['id']).status.code).toBe(
      ErrorCode.SELECTOR_NOT_SUPPORTED,
    );
  });

  test('forwards the result across the background bridge', async () => {
    const invoke = rstest.fn((_endpoint, args: Parameters<GetFieldsHandler>) =>
      Promise.resolve(handler(...args))
    );
    const callback = rstest.fn();
    createGetFields({ invoke } as unknown as Rpc)(
      IdentifierType.ID_SELECTOR,
      '#target',
      '',
      true,
      ['tag'],
      callback,
      undefined,
    );
    expect(callback).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(invoke).toHaveBeenCalledWith(getFieldsEndpoint, [
      IdentifierType.ID_SELECTOR,
      '#target',
      '',
      true,
      ['tag'],
      undefined,
    ]);
    expect(callback).toHaveBeenCalledExactlyOnceWith({
      data: { tag: 'text' },
      status: { code: 0, data: 'success' },
    });
  });

  test.each([true, false])(
    'reports RPC failures for firstOnly=%s',
    async (firstOnly) => {
      const invoke = rstest.fn(() => Promise.reject(new Error('RPC failed')));
      const callback = rstest.fn();
      createGetFields({ invoke } as unknown as Rpc)(
        IdentifierType.ID_SELECTOR,
        '#target',
        '',
        firstOnly,
        ['id'],
        callback,
      );
      await Promise.resolve();
      expect(callback).toHaveBeenCalledExactlyOnceWith({
        data: firstOnly ? null : [],
        status: { code: ErrorCode.UNKNOWN, data: 'RPC failed' },
      });
    },
  );

  test('handles RPC errors without a serialized Error object', async () => {
    const invoke = rstest.fn(() => Promise.reject(undefined));
    const callback = rstest.fn();
    createGetFields({ invoke } as unknown as Rpc)(
      IdentifierType.ID_SELECTOR,
      '#target',
      '',
      true,
      ['id'],
      callback,
    );
    await Promise.resolve();
    expect(callback).toHaveBeenCalledExactlyOnceWith({
      data: null,
      status: { code: ErrorCode.UNKNOWN, data: 'getFields failed' },
    });
  });
});
