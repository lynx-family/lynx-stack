import {
  type StartMainThreadContextConfig,
  type RpcCallType,
  type updateDataEndpoint,
  type MainThreadGlobalThis,
  i18nResourceTranslationEndpoint,
  type I18nResourceTranslationOptions,
  getCacheI18nResourcesKey,
} from '@lynx-js/web-constants';
import { Rpc } from '@lynx-js/web-worker-rpc';

const {
  prepareMainThreadAPIs,
} = await import('@lynx-js/web-mainthread-apis');

const CacheI18nResources = new Map<string, unknown>();

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
  const i18nResourceTranslation = (options: I18nResourceTranslationOptions) => {
    const cacheKey = getCacheI18nResourcesKey(options);

    if (CacheI18nResources.has(cacheKey)) {
      return CacheI18nResources.get(cacheKey);
    }
    mainToBackgroundRpc.invoke(i18nResourceTranslationEndpoint, [options]).then(
      res => {
        if (res !== undefined) {
          CacheI18nResources.set(cacheKey, res);
        }
      },
    );
    return undefined;
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
    i18nResourceTranslation,
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
