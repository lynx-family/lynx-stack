import { parentPort } from 'node:worker_threads';
import { Rpc } from '../dist/index.js';
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
} from './endpoints.js';

console.log('worker started');

function waitImpl(ms) {
  // @ts-ignore
  const { promise, resolve } = Promise.withResolvers();
  setTimeout(() => resolve(), ms);
  return promise;
}

parentPort.on('message', async (ev) => {
  if (ev.type === 'init') {
    const port = ev.port;
    const privatePort = ev.privatePort;
    const rpc = new Rpc(port, 'worker');
    rpc.registerHandler(addAsync, async (a, b) => {
      return a + b;
    });
    rpc.registerHandler(addSync, (a, b) => a + b);
    rpc.registerHandler(throwError, async () => {
      throw new Error('test async error');
    });
    rpc.registerHandler(throwErrorSync, () => {
      throw new Error('test sync error');
    });
    rpc.registerHandler(wait, waitImpl);
    rpc.registerHandler(waitSync, waitImpl);

    const emptyObj = {};
    rpc.registerHandlerLazy(testLazy, emptyObj, 'testLazy');
    emptyObj.testLazy = (a, b) => a + b;

    rpc.registerHandler(addAsyncWithTransfer, () => {
      const buffer = new ArrayBuffer(100);
      return { data: buffer, transfer: [buffer] };
    });
    rpc.registerHandler(changeLazyHandler, () => {
      emptyObj.testLazy = () => 100;
    });
    rpc.registerHandler(callbackifyEndpoint, async (a, b) => {
      return a + b;
    });
    privatePort.postMessage({ type: 'ready' });
  }
});
