import { Rpc } from '@lynx-js/web-worker-rpc';
import {
  addAsync,
  addSync,
  consoleLog,
  consoleLogSync,
  throwError,
  throwErrorSync,
  wait,
  waitSync,
  testLazy,
  addAsyncWithTransfer,
} from './endpoints.ts';
globalThis.onmessage = (ev) => {
  const port = ev.data.port as MessagePort;
  const rpc = new Rpc(port, 'worker');
  Object.assign(globalThis, {
    addAsync: rpc.createCall(addAsync),
    addSync: rpc.createCall(addSync),
    consoleLog: rpc.createCall(consoleLog),
    consoleLogSync: rpc.createCall(consoleLogSync),
    throwError: rpc.createCall(throwError),
    throwErrorSync: rpc.createCall(throwErrorSync),
    wait: rpc.createCall(wait),
    waitSync: rpc.createCall(waitSync),
    testLazy: rpc.createCall(testLazy),
    addAsyncWithTransfer: rpc.createCall(addAsyncWithTransfer),
  });
};
