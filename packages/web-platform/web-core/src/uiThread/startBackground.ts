import {
  getCacheI18nResourcesKey,
  markTimingEndpoint,
  sendGlobalEventEndpoint,
  updateDataEndpoint,
  updateI18nResourceEndpoint,
  type Cloneable,
  type I18nResourceTranslationOptions,
  type InitI18nResources,
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
import { registerGetPathInfoHandler } from './crossThreadHandlers/registerGetPathInfoHandler.js';

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
  registerGetPathInfoHandler(
    backgroundRpc,
    shadowRoot,
  );
  registerDispatchLynxViewEventHandler(backgroundRpc, shadowRoot);
  registerTriggerElementMethodEndpointHandler(backgroundRpc, shadowRoot);
  registerReportErrorHandler(
    backgroundRpc,
    'app-service.js',
    callbacks.onError,
  );

  const sendGlobalEvent = backgroundRpc.createCall(sendGlobalEventEndpoint);
  const markTiming = backgroundRpc.createCall(markTimingEndpoint);
  const updateDataBackground = backgroundRpc.createCall(updateDataEndpoint);
  const updateI18nResourceBackground = (
    data: InitI18nResources,
    options: I18nResourceTranslationOptions,
  ) => {
    const matchedResources = data.find(i =>
      getCacheI18nResourcesKey(i.options)
        === getCacheI18nResourcesKey(options)
    );
    backgroundRpc.invoke(updateI18nResourceEndpoint, [
      matchedResources?.resource as Cloneable,
    ]);
  };
  return {
    sendGlobalEvent,
    markTiming,
    updateDataBackground,
    updateI18nResourceBackground,
  };
}
