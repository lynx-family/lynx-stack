import { afterAll, describe, test, expect } from 'vitest';
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
} from './endpoints';
import { Worker } from 'node:worker_threads';

const worker = new Worker(new URL('./worker.js', import.meta.url));
const privateChannel = new MessageChannel();

const readyPromise = new Promise<void>((resolve) => {
  const handler = (ev: MessageEvent) => {
    if (ev.data.type === 'ready') {
      privateChannel.port1.removeEventListener('message', handler);
      resolve();
    }
  };
  privateChannel.port1.addEventListener('message', handler);
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
  afterAll(() => {
    worker.terminate();
    channel.port1.close();
    channel.port2.close();
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
    }).toThrowError('test sync error');
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

  test('async return with transfer', async () => {
    const ret = await addAsyncWithTransferFn() as unknown as ArrayBuffer;
    // The implementation returns { data: buffer, transfer: [buffer] }
    // The RPC implementation unwraps it and returns the data.
    expect(ret).toBeInstanceOf(ArrayBuffer);
    expect(ret.byteLength).toBe(100);
  });
});
