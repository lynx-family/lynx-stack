import {
  markTimingEndpoint,
  sendGlobalEventEndpoint,
  updateDataEndpoint,
} from '@lynx-js/web-constants';
import type { Rpc } from '@lynx-js/web-worker-rpc';
import { registerInvokeUIMethodHandler } from './crossThreadHandlers/registerInvokeUIMethodHandler.js';
import { registerNativePropsHandler } from './crossThreadHandlers/registerSetNativePropsHandler.js';
import { registerNativeModulesCallHandler } from './crossThreadHandlers/registerNativeModulesCallHandler.js';
import { registerTriggerComponentEventHandler } from './crossThreadHandlers/registerTriggerComponentEventHandler.js';
import { registerSelectComponentHandler } from './crossThreadHandlers/registerSelectComponentHandler.js';
import { registerNapiModulesCallHandler } from './crossThreadHandlers/registerNapiModulesCallHandler.js';
import { registerDispatchLynxViewEventHandler } from './crossThreadHandlers/registerDispatchLynxViewEventHandler.js';
import { registerTriggerElementMethodEndpointHandler } from './crossThreadHandlers/registerTriggerElementMethodEndpointHandler.js';
import type { StartUIThreadCallbacks } from './startUIThread.js';
import { registerReportErrorHandler } from './crossThreadHandlers/registerReportErrorHandler.js';

export function startBackground(
  backgroundRpc: Rpc,
  shadowRoot: ShadowRoot,
  callbacks: StartUIThreadCallbacks,
) {
  registerInvokeUIMethodHandler(
    backgroundRpc,
    shadowRoot,
  );
  registerNativePropsHandler(
    backgroundRpc,
    shadowRoot,
  );
  registerTriggerComponentEventHandler(
    backgroundRpc,
    shadowRoot,
  );
  registerSelectComponentHandler(
    backgroundRpc,
    shadowRoot,
  );
  registerNativeModulesCallHandler(
    backgroundRpc,
    callbacks.nativeModulesCall,
  );
  registerNapiModulesCallHandler(
    backgroundRpc,
    callbacks.napiModulesCall,
  );
  registerDispatchLynxViewEventHandler(backgroundRpc, shadowRoot);
  registerTriggerElementMethodEndpointHandler(backgroundRpc, shadowRoot);
  registerReportErrorHandler(backgroundRpc, callbacks.onError);

  const sendGlobalEvent = backgroundRpc.createCall(sendGlobalEventEndpoint);
  const markTiming = backgroundRpc.createCall(markTimingEndpoint);
  const updateDataBackground = backgroundRpc.createCall(updateDataEndpoint);
  return {
    sendGlobalEvent,
    markTiming,
    updateDataBackground,
  };
}
