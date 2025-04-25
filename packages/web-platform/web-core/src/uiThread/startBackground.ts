import {
  markTimingEndpoint,
  sendGlobalEventEndpoint,
  updateDataEndpoint,
  type NapiModulesCall,
  type NativeModulesCall,
} from '@lynx-js/web-constants';
import type { Rpc } from '@lynx-js/web-worker-rpc';
import { registerInvokeUIMethodHandler } from './crossThreadHandlers/registerInvokeUIMethodHandler.js';
import { registerNativePropsHandler } from './crossThreadHandlers/registerSetNativePropsHandler.js';
import { registerNativeModulesCallHandler } from './crossThreadHandlers/registerNativeModulesCallHandler.js';
import { registerTriggerComponentEventHandler } from './crossThreadHandlers/registerTriggerComponentEventHandler.js';
import { registerSelectComponentHandler } from './crossThreadHandlers/registerSelectComponentHandler.js';
import { registerNapiModulesCallHandler } from './crossThreadHandlers/registerNapiModulesCallHandler.js';
import { registerDispatchLynxViewEventHandler } from './crossThreadHandlers/registerDispatchLynxViewEventHandler.js';

export function startBackground(
  backgroundRpc: Rpc,
  shadowRoot: ShadowRoot,
  callbacks: {
    nativeModulesCall: NativeModulesCall;
    napiModulesCall: NapiModulesCall;
  },
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

  const sendGlobalEvent = backgroundRpc.createCall(sendGlobalEventEndpoint);
  const markTiming = backgroundRpc.createCall(markTimingEndpoint);
  const updateDataBackground = backgroundRpc.createCall(updateDataEndpoint);
  return {
    sendGlobalEvent,
    markTiming,
    updateDataBackground,
  };
}
