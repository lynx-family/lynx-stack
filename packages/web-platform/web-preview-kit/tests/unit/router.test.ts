// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, rstest, test } from '@rstest/core';

import { ProtocolException } from '../../src/page/errors.js';
import { RequestRouter } from '../../src/page/router.js';
import type { Handlers } from '../../src/page/router.js';
import type { ResponseMessage } from '../../src/protocol.js';

function createHandlers(overrides: Partial<Handlers> = {}): Handlers {
  const fail = () => {
    throw new Error('not expected');
  };
  return {
    'project.open': fail,
    'project.configure': fail,
    'project.close': () => undefined,
    'fs.apply': () => ({ revision: 2 }),
    'fs.read': ({ path }) => ({ content: path }),
    'fs.list': () => ({ files: [] }),
    'build.getAsset': fail,
    'preview.select': ({ card }) => ({ card }),
    'preview.reload': () => undefined,
    'preview.setData': () => undefined,
    ...overrides,
  };
}

async function send(
  router: RequestRouter,
  message: unknown,
): Promise<ResponseMessage[]> {
  const responses: ResponseMessage[] = [];
  router.receive(message, response => responses.push(response));
  await router.idle();
  return responses;
}

async function errorCode(handlers: Handlers, method: string, params: unknown) {
  const [response] = await send(new RequestRouter(handlers), {
    id: 1,
    method,
    params,
  });
  return response && 'error' in response ? response.error.code : 'resolved';
}

describe('RequestRouter', () => {
  test('answers with the result and the id', async () => {
    expect(
      await send(new RequestRouter(createHandlers()), {
        id: 7,
        method: 'fs.read',
        params: { path: 'src/a.ts' },
      }),
    ).toEqual([{ id: 7, result: { content: 'src/a.ts' } }]);
  });

  test('drops messages it cannot answer', async () => {
    const warn = rstest.spyOn(console, 'warn').mockImplementation(() => {});
    const router = new RequestRouter(createHandlers());
    expect(await send(router, null)).toEqual([]);
    expect(await send(router, { method: 'fs.list' })).toEqual([]);
    expect(await send(router, { id: '1', method: 'fs.list' })).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });

  test('INVALID_REQUEST and UNKNOWN_METHOD', async () => {
    expect(await errorCode(createHandlers(), undefined as never, {})).toBe(
      'INVALID_REQUEST',
    );
    expect(await errorCode(createHandlers(), 'fs.nope', {})).toBe(
      'UNKNOWN_METHOD',
    );
    expect(await errorCode(createHandlers(), 'toString', {})).toBe(
      'UNKNOWN_METHOD',
    );
  });

  test('INVALID_PARAMS', async () => {
    const handlers = createHandlers();
    const cases: [string, unknown][] = [
      ['project.open', undefined],
      ['project.open', { files: {}, config: { entries: {} } }],
      ['project.open', { files: [], config: { entries: { main: 'a.tsx' } } }],
      ['project.open', {
        files: { 'a.ts': 1 },
        config: { entries: { a: 'a' } },
      }],
      ['project.open', {
        files: {},
        config: { entries: { a: 'a' }, mode: 'x' },
      }],
      ['project.open', { files: {}, config: { entries: { a: 'a' }, hmr: 1 } }],
      ['project.open', { files: {}, config: { entries: { a: 'a' } }, card: 1 }],
      ['project.open', { files: {}, config: { entries: { a: 'a' } }, data: 1 }],
      ['project.configure', { config: { entries: { a: 1 } } }],
      ['fs.apply', { changes: {} }],
      ['fs.apply', { changes: [{ type: 'move', path: 'a' }] }],
      ['fs.apply', { changes: [{ type: 'write', path: 'a' }] }],
      ['fs.read', { path: 'a', encoding: 'latin1' }],
      ['fs.read', { path: 1 }],
      ['fs.list', 'yes'],
      ['preview.select', { card: '' }],
      ['preview.setData', 'data'],
    ];
    for (const [method, params] of cases) {
      expect([method, params, await errorCode(handlers, method, params)])
        .toEqual([method, params, 'INVALID_PARAMS']);
    }
  });

  test('INVALID_PATH, and nothing of the batch is applied', async () => {
    const apply = rstest.fn(() => ({ revision: 2 }));
    const handlers = createHandlers({ 'fs.apply': apply });
    for (
      const changes of [
        [
          { type: 'write', path: 'ok.ts', content: '' },
          { type: 'write', path: '../escape.ts', content: '' },
        ],
        [{ type: 'delete', path: '/abs' }],
        [{ type: 'rename', from: 'a.ts', to: 'b//c.ts' }],
        [{ type: 'rename', from: 'a\\b', to: 'c' }],
      ]
    ) {
      expect(await errorCode(handlers, 'fs.apply', { changes })).toBe(
        'INVALID_PATH',
      );
    }
    expect(apply).not.toHaveBeenCalled();
    expect(
      await errorCode(createHandlers(), 'project.open', {
        files: { 'src/./a.ts': '' },
        config: { entries: { main: 'src/a.ts' } },
      }),
    ).toBe('INVALID_PATH');
    expect(
      await errorCode(createHandlers(), 'project.open', {
        files: {},
        config: { entries: { main: '/src/a.ts' } },
      }),
    ).toBe('INVALID_PATH');
    expect(await errorCode(createHandlers(), 'build.getAsset', { name: '..' }))
      .toBe('INVALID_PATH');
  });

  test('passes the validated parameters', async () => {
    const open = rstest.fn(() => ({ revision: 1 }));
    const bytes = new Uint8Array([1, 2]);
    await send(new RequestRouter(createHandlers({ 'project.open': open })), {
      id: 1,
      method: 'project.open',
      params: {
        files: { 'src/a.tsx': 'a', 'node_modules/x/index.js': bytes },
        config: { entries: { main: 'src/a.tsx' }, extra: true },
        unknown: 1,
      },
    });
    expect(open).toHaveBeenCalledWith({
      files: { 'src/a.tsx': 'a', 'node_modules/x/index.js': bytes },
      config: { entries: { main: 'src/a.tsx' } },
    });
  });

  test('passes the code of a ProtocolException and wraps other errors', async () => {
    expect(
      await errorCode(
        createHandlers({
          'preview.reload': () => {
            throw new ProtocolException('NOT_OPEN', 'closed');
          },
        }),
        'preview.reload',
        undefined,
      ),
    ).toBe('NOT_OPEN');
    const [response] = await send(
      new RequestRouter(createHandlers({
        'fs.list': () => Promise.reject(new Error('boom')),
      })),
      { id: 3, method: 'fs.list' },
    );
    expect(response).toEqual({
      id: 3,
      error: { code: 'INTERNAL', message: 'boom' },
    });
  });

  test('answers every request once, in arrival order', async () => {
    let release!: () => void;
    const slow = new Promise<void>(resolve => {
      release = resolve;
    });
    const order: string[] = [];
    const router = new RequestRouter(createHandlers({
      'fs.apply': async () => {
        order.push('apply started');
        await slow;
        order.push('apply finished');
        return { revision: 2 };
      },
      'fs.list': () => {
        order.push('list');
        return { files: [] };
      },
    }));
    const responses: ResponseMessage[] = [];
    router.receive(
      { id: 1, method: 'fs.apply', params: { changes: [] } },
      response => responses.push(response),
    );
    router.receive(
      { id: 2, method: 'fs.list' },
      response => responses.push(response),
    );
    router.receive(
      { id: 3, method: 'nope' },
      response => responses.push(response),
    );
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(responses).toEqual([]);
    release();
    await router.idle();
    expect(order).toEqual(['apply started', 'apply finished', 'list']);
    expect(responses.map(response => response.id)).toEqual([1, 2, 3]);
  });
});
