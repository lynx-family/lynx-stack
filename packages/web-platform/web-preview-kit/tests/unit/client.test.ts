// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, describe, expect, test } from '@rstest/core';

import {
  PreviewClientError,
  PreviewRequestError,
  createPreviewClient,
} from '../../src/client/index.js';
import type {
  HelloInfo,
  KitMessage,
  PortLike,
  RequestMessage,
} from '../../src/client/index.js';

const hello: HelloInfo = { version: 1, supported: true, builtinPackages: {} };

/** A port whose other end is driven by the test, like the kit would. */
function createFakeKit() {
  const channel = new MessageChannel();
  const requests: RequestMessage[] = [];
  let waiting: (() => void) | undefined;
  channel.port2.onmessage = (event: MessageEvent<RequestMessage>) => {
    requests.push(event.data);
    waiting?.();
  };
  return {
    port: channel.port1 as unknown as PortLike,
    requests,
    send(message: KitMessage) {
      channel.port2.postMessage(message);
    },
    async nextRequest(): Promise<RequestMessage> {
      while (requests.length === 0) {
        await new Promise<void>(resolve => {
          waiting = resolve;
        });
      }
      return requests.shift()!;
    },
    close() {
      channel.port1.close();
      channel.port2.close();
    },
  };
}

let kit: ReturnType<typeof createFakeKit>;

afterEach(() => {
  kit?.close();
});

describe('createPreviewClient', () => {
  test('sends requests and resolves them with their own response', async () => {
    kit = createFakeKit();
    const client = createPreviewClient(kit.port, hello);
    expect(client.hello).toBe(hello);
    const listed = client.listFiles();
    const read = client.readFile('src/a.ts', 'binary');
    const first = await kit.nextRequest();
    const second = await kit.nextRequest();
    expect(first).toEqual({ id: 1, method: 'fs.list', params: undefined });
    expect(second).toEqual({
      id: 2,
      method: 'fs.read',
      params: { path: 'src/a.ts', encoding: 'binary' },
    });
    // Answered out of order.
    kit.send({ id: 2, result: { content: new Uint8Array([1]) } });
    kit.send({ id: 1, result: { files: ['src/a.ts'] } });
    expect(await read).toEqual(new Uint8Array([1]));
    expect(await listed).toEqual(['src/a.ts']);
  });

  test('helpers send the protocol messages', async () => {
    kit = createFakeKit();
    const client = createPreviewClient(kit.port, hello);
    const calls = [
      () =>
        client.open({ 'a.ts': '' }, { entries: { a: 'a.ts' } }, { card: 'a' }),
      () => client.configure({ entries: { a: 'a.ts' }, hmr: false }),
      () => client.close(),
      () => client.applyChanges([{ type: 'delete', path: 'a.ts' }]),
      () => client.writeFile('a.ts', 'x'),
      () => client.getAsset('a.web.bundle'),
      () => client.selectCard('a'),
      () => client.reload(),
      () => client.setData({ initData: { a: 1 } }),
      () => client.request('fs.read', { path: 'a.ts' }),
    ];
    for (const call of calls) {
      void call().catch(() => {});
    }
    const seen = [];
    for (let i = 0; i < calls.length; i++) {
      const { method, params } = await kit.nextRequest();
      seen.push({ method, params });
    }
    expect(seen).toEqual([
      {
        method: 'project.open',
        params: {
          files: { 'a.ts': '' },
          config: { entries: { a: 'a.ts' } },
          card: 'a',
        },
      },
      {
        method: 'project.configure',
        params: { config: { entries: { a: 'a.ts' }, hmr: false } },
      },
      { method: 'project.close', params: undefined },
      {
        method: 'fs.apply',
        params: { changes: [{ type: 'delete', path: 'a.ts' }] },
      },
      {
        method: 'fs.apply',
        params: { changes: [{ type: 'write', path: 'a.ts', content: 'x' }] },
      },
      { method: 'build.getAsset', params: { name: 'a.web.bundle' } },
      { method: 'preview.select', params: { card: 'a' } },
      { method: 'preview.reload', params: undefined },
      { method: 'preview.setData', params: { initData: { a: 1 } } },
      { method: 'fs.read', params: { path: 'a.ts' } },
    ]);
    client.dispose();
  });

  test('rejects with the protocol error', async () => {
    kit = createFakeKit();
    const client = createPreviewClient(kit.port, hello);
    const selected = client.selectCard('nope');
    const { id } = await kit.nextRequest();
    kit.send({ id, error: { code: 'UNKNOWN_CARD', message: 'no such card' } });
    const error = await selected.catch((error: unknown) => error);
    expect(error).toBeInstanceOf(PreviewRequestError);
    expect(error).toMatchObject({
      code: 'UNKNOWN_CARD',
      method: 'preview.select',
    });
  });

  test('delivers events to listeners until they unsubscribe', async () => {
    kit = createFakeKit();
    const client = createPreviewClient(kit.port, hello);
    const seen: unknown[] = [];
    const off = client.on('build.start', data => seen.push(data));
    client.on('preview.hmr', data => seen.push(data));
    kit.send({ event: 'build.start', data: { buildId: 1, revision: 1 } });
    kit.send({ event: 'preview.hmr', data: { card: 'a', hash: 'h' } });
    // A response to nothing pending is ignored.
    kit.send({ id: 99, result: undefined });
    await new Promise(resolve => setTimeout(resolve, 20));
    off();
    kit.send({ event: 'build.start', data: { buildId: 2, revision: 2 } });
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(seen).toEqual([
      { buildId: 1, revision: 1 },
      { card: 'a', hash: 'h' },
    ]);
  });

  test('dispose rejects pending requests and later ones', async () => {
    kit = createFakeKit();
    const client = createPreviewClient(kit.port, hello);
    const pending = client.reload();
    await kit.nextRequest();
    client.dispose();
    const error = await pending.catch((error: unknown) => error);
    expect(error).toBeInstanceOf(PreviewClientError);
    expect(error).toMatchObject({ reason: 'disposed' });
    await expect(client.listFiles()).rejects.toMatchObject({
      reason: 'disposed',
    });
    client.dispose();
  });
});
