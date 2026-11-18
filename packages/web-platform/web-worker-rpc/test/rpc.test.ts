import { afterAll, describe, test, expect } from '@rstest/core';
import { MessageChannel, Worker } from 'node:worker_threads';

import { Rpc } from '../src/index.js';
import {
  addAsync,
  addSync,
  throwError,
  throwErrorSync,
  wait,
  waitSync,
  testLazy,
  addAsyncWithTransfer,
  changeLazyHandler,
  callbackifyEndpoint,
} from './endpoints';

const worker = new Worker(new URL('./worker.js', import.meta.url));
const privateChannel = new MessageChannel();

const readyPromise = new Promise<void>((resolve, reject) => {
  function cleanup() {
    privateChannel.port1.removeEventListener('message', handleReady);
    worker.off('error', handleError);
    worker.off('exit', handleExit);
  }

  function handleReady(ev: MessageEvent) {
    if (ev.data.type === 'ready') {
      cleanup();
      resolve();
    }
  }

  function handleError(error: Error) {
    cleanup();
    reject(error);
  }

  function handleExit(code: number) {
    cleanup();
    reject(new Error(`Worker exited before ready with code ${code}`));
  }

  worker.once('error', handleError);
  worker.once('exit', handleExit);
  privateChannel.port1.addEventListener('message', handleReady);
});
const channel = new MessageChannel();
const rpc = new Rpc(channel.port1, 'main');
// @ts-expect-error
worker.postMessage({
  type: 'init',
  port: channel.port2,
  privatePort: privateChannel.port2,
}, [channel.port2, privateChannel.port2]);
await readyPromise;

const addAsyncFn = rpc.createCall(addAsync);
const addSyncFn = rpc.createCall(addSync);
const throwErrorFn = rpc.createCall(throwError);
const throwErrorSyncFn = rpc.createCall(throwErrorSync);
const waitFn = rpc.createCall(wait);
const waitSyncFn = rpc.createCall(waitSync);
const testLazyFn = rpc.createCall(testLazy);
const addAsyncWithTransferFn = rpc.createCall(addAsyncWithTransfer);
const changeLazyHandlerFn = rpc.createCall(changeLazyHandler);
describe('rpc tests', () => {
  afterAll(async () => {
    privateChannel.port1.close();
    privateChannel.port2.close();
    channel.port1.close();
    channel.port2.close();
    await worker.terminate();
  });

  test('addAsync', async () => {
    const ret = await addAsyncFn(2, 3);
    expect(ret).toBe(5);
  });

  test('addSync', () => {
    const ret = addSyncFn(2, 3);
    expect(ret).toBe(5);
  });

  test('throwError async', async () => {
    const promise = throwErrorFn();
    await expect(promise).rejects.toThrow('test async error');
  });

  test('throwError sync', async () => {
    expect(() => {
      throwErrorSyncFn();
    }).toThrow();
  });

  test('wait async', async () => {
    const t1 = performance.now();
    await waitFn(1000);
    const t2 = performance.now();

    expect(t2 - t1).toBeGreaterThan(800);
  });

  test('wait sync', async () => {
    const t1 = performance.now();
    waitSyncFn(1000);
    const t2 = performance.now();

    expect(t2 - t1).toBeGreaterThan(800);
  });

  test('lazy handler', async () => {
    const ret = await testLazyFn(2, 3);
    expect(ret).toBe(5);
  });

  test('lazy handler change object handler', async () => {
    const ret = await testLazyFn(2, 3);
    expect(ret).toBe(5);
    await changeLazyHandlerFn();
    const ret2 = await testLazyFn(2, 3);
    expect(ret2).toBe(100);
  });

  test('RPC reads the current lazy handler after assignment, replacement and deletion', async () => {
    const { port1, port2 } = new MessageChannel();
    try {
      const caller = new Rpc(port1, 'caller');
      const callee = new Rpc(port2, 'callee');
      type Slot = { handler?: (a: number, b: number) => Promise<number> };
      const target: Slot = {};
      const unset: Slot = {};
      callee.registerHandlerLazy(testLazy, target as Required<Slot>, 'handler');
      callee.registerHandlerLazy(testLazy, unset as Required<Slot>, 'handler');
      expect(Object.keys(target)).toEqual(['handler']);
      expect(delete unset.handler).toBe(true);
      expect(Object.hasOwn(unset, 'handler')).toBe(false);

      // Wait until the first call reaches the callee before activating the setter.
      const received = new Promise<void>((resolve) => {
        port2.addEventListener('message', () => resolve(), { once: true });
      });
      const call = caller.createCall(testLazy);
      const pending = call(2, 3);
      await received;
      target.handler = async (a, b) => a + b;
      await expect(pending).resolves.toBe(5);

      Object.defineProperty(target, 'handler', { value: async () => 42 });
      await expect(call(2, 3)).resolves.toBe(42);

      expect(delete target.handler).toBe(true);
      expect(Object.hasOwn(target, 'handler')).toBe(false);
      await expect(call(2, 3)).resolves.toBeUndefined();
    } finally {
      port1.close();
      port2.close();
    }
  });

  test('async return with transfer', async () => {
    const ret = await addAsyncWithTransferFn() as unknown as ArrayBuffer;
    // The implementation returns { data: buffer, transfer: [buffer] }
    // The RPC implementation unwraps it and returns the data.
    expect(ret).toBeInstanceOf(ArrayBuffer);
    expect(ret.byteLength).toBe(100);
  });

  test('callbackify', async () => {
    const fn = rpc.createCallbackify(callbackifyEndpoint, 2);
    // (a, b, callback)
    const promise = new Promise<number>((resolve) => {
      fn(2, 3, (ret: number) => {
        resolve(ret);
      });
    });
    const ret = await promise;
    expect(ret).toBe(5);
  });

  test('set message port', async () => {
    const channel = new MessageChannel();
    // buffer flush
    const rpc = new Rpc(undefined, 'test');
    rpc.postMessage({
      type: 'test',
    });
    // flush
    rpc.setMessagePort(channel.port1);
    expect(() => {
      rpc.setMessagePort(channel.port1);
    }).toThrow('Rpc port already set');
    channel.port1.close();
    channel.port2.close();
  });

  test('remove handler', () => {
    const rpc = new Rpc(undefined, 'test');
    rpc.registerHandler(addAsync, async (a, b) => a + b);
    rpc.removeHandler(addAsync);
  });
});
