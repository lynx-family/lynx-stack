import { Rpc } from '@lynx-js/web-worker-rpc';
import {
  addAsync,
  addSync,
  consoleLog,
  consoleLogSync,
  testLazy,
  throwError,
  throwErrorSync,
  wait,
  waitSync,
  addAsyncWithTransfer,
} from './endpoints.ts';

const channel = new MessageChannel();

const worker = new Worker(
  new URL('./worker.ts', import.meta.url),
  {
    type: 'module',
    name: 'worker',
  },
);

const rpc = new Rpc(channel.port1, 'main');

function waitImpl(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(() => resolve(), ms);
  return promise;
}

rpc.registerHandler(addAsync, async (a, b) => a + b);
rpc.registerHandler(addSync, (a, b) => a + b);
rpc.registerHandler(consoleLog, async (msg) => console.log(msg));
rpc.registerHandler(consoleLogSync, (msg) => console.log(msg));
rpc.registerHandler(throwError, async () => {
  throw new Error();
});
rpc.registerHandler(throwErrorSync, () => {
  throw new Error();
});
rpc.registerHandler(wait, waitImpl);
rpc.registerHandler(waitSync, waitImpl);
const emptyObj: any = {};
Object.assign(globalThis, { emptyObj });
rpc.registerHandlerLazy(testLazy, emptyObj, 'testLazy');
emptyObj.testLazy = (a, b) => a + b;
rpc.registerHandler(addAsyncWithTransfer, () => {
  const ele = document.createElement('canvas') as HTMLCanvasElement;
  document.body.appendChild(ele);
  const offscreen = ele.transferControlToOffscreen();
  return { data: offscreen, transfer: [offscreen] };
});

worker.postMessage({ port: channel.port2 }, { transfer: [channel.port2] });
