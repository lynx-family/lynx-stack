import {
  type StartMainThreadContextConfig,
  type RpcCallType,
  type updateDataEndpoint,
  type MainThreadGlobalThis,
  type I18nResourceTranslationOptions,
  type CloneableObject,
  i18nResourceMissedEventName,
  I18nResources,
  type InitI18nResources,
  type Cloneable,
} from '@lynx-js/web-constants';
import { Rpc } from '@lynx-js/web-worker-rpc';
import { dispatchLynxViewEvent } from '../utils/dispatchLynxViewEvent.js';

const {
  prepareMainThreadAPIs,
} = await import('@lynx-js/web-mainthread-apis');

export function createRenderAllOnUI(
  mainToBackgroundRpc: Rpc,
  shadowRoot: ShadowRoot,
  markTimingInternal: (
    timingKey: string,
    pipelineId?: string,
    timeStamp?: number,
  ) => void,
  callbacks: {
    onError?: (err: Error) => void;
  },
) {
  if (!globalThis.module) {
    Object.assign(globalThis, { module: {} });
  }
  const triggerI18nResourceFallback = (
    options: I18nResourceTranslationOptions,
  ) => {
    dispatchLynxViewEvent(
      shadowRoot,
      i18nResourceMissedEventName,
      options as CloneableObject,
    );
  };
  const i18nResources = new I18nResources();
  const { startMainThread } = prepareMainThreadAPIs(
    mainToBackgroundRpc,
    shadowRoot,
    document.createElement.bind(document),
    () => {},
    markTimingInternal,
    (err) => {
      callbacks.onError?.(err);
    },
    triggerI18nResourceFallback,
    (initI18nResources: InitI18nResources) => {
      i18nResources.setData(initI18nResources);
      return i18nResources;
    },
  );
  let mtsGlobalThis!: MainThreadGlobalThis;
  const start = async (configs: StartMainThreadContextConfig) => {
    const mainThreadRuntime = startMainThread(configs);
    mtsGlobalThis = await mainThreadRuntime;
  };
  const updateDataMainThread: RpcCallType<typeof updateDataEndpoint> = async (
    ...args
  ) => {
    mtsGlobalThis.updatePage?.(...args);
  };
  const updateI18nResourcesMainThread = (data: Cloneable) => {
    i18nResources.setData(data as InitI18nResources);
  };
  return {
    start,
    updateDataMainThread,
    updateI18nResourcesMainThread,
  };
}
