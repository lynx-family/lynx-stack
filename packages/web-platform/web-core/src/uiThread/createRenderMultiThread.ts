import {
  mainThreadStartEndpoint,
  updateDataEndpoint,
} from '@lynx-js/web-constants';
import type { Rpc } from '@lynx-js/web-worker-rpc';
import { registerReportErrorHandler } from './crossThreadHandlers/registerReportErrorHandler.js';
import { registerFlushElementTreeHandler } from './crossThreadHandlers/registerFlushElementTreeHandler.js';
import { registerDispatchLynxViewEventHandler } from './crossThreadHandlers/registerDispatchLynxViewEventHandler.js';

export function createRenderMultiThread(
  mainThreadRpc: Rpc,
  shadowRoot: ShadowRoot,
  callbacks: {
    onError?: (err: Error) => void;
  },
) {
  registerReportErrorHandler(
    mainThreadRpc,
    callbacks.onError,
  );
  registerFlushElementTreeHandler(
    mainThreadRpc,
    {
      shadowRoot,
    },
  );
  registerDispatchLynxViewEventHandler(mainThreadRpc, shadowRoot);
  const start = mainThreadRpc.createCall(mainThreadStartEndpoint);
  const updateDataMainThread = mainThreadRpc.createCall(updateDataEndpoint);
  return {
    start,
    updateDataMainThread,
  };
}
