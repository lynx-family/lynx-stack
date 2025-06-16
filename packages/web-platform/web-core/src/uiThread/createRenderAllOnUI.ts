import {
  type StartMainThreadContextConfig,
  type RpcCallType,
  type updateDataEndpoint,
  type MainThreadGlobalThis,
  type I18nResourceTranslationOptions,
  type CloneableObject,
  i18nResourceMissedEventName,
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
  return {
    start,
    updateDataMainThread,
  };
}
