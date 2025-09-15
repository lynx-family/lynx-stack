import {
  queryComponentEndpoint,
  updateBTSTemplateCacheEndpoint,
  type JSRealm,
  type LynxCrossThreadContext,
  type MainThreadGlobalThis,
  type QueryComponentPAPI,
  type Rpc,
  type RpcCallType,
  type StyleInfo,
  type TemplateLoader,
} from '@lynx-js/web-constants';

export function createQueryComponent(
  loadTemplate: TemplateLoader,
  updateLazyComponentStyle: (styleInfo: StyleInfo, entryName: string) => void,
  backgroundThreadRpc: Rpc,
  mtsGlobalThisRef: {
    mtsGlobalThis: MainThreadGlobalThis;
  },
  jsContext: LynxCrossThreadContext,
  mtsRealm: JSRealm,
): QueryComponentPAPI {
  const updateBTSTemplateCache = backgroundThreadRpc.createCall(
    updateBTSTemplateCacheEndpoint,
  );
  const __QueryComponentImpl: QueryComponentPAPI = (url, callback) => {
    loadTemplate(url).then(async (template) => {
      const updateBTSCachePromise = updateBTSTemplateCache(url, template);
      let lepusRootChunkExport = await mtsRealm.loadScript(
        template.lepusCode.root,
      );
      if (mtsGlobalThisRef.mtsGlobalThis.processEvalResult) {
        lepusRootChunkExport = mtsGlobalThisRef.mtsGlobalThis.processEvalResult(
          lepusRootChunkExport,
          url,
        );
      }
      updateLazyComponentStyle(template.styleInfo, url);
      await updateBTSCachePromise;
      jsContext.dispatchEvent({
        type: '__OnDynamicJSSourcePrepared',
        data: url,
      });
      callback?.({
        code: 0,
        data: {
          url,
          evalResult: lepusRootChunkExport,
        },
      });
    }).catch((error) => {
      console.error(`lynx web: lazy bundle load failed:`, error);
      callback?.({
        code: -1,
        data: undefined,
      });
    });
    return null;
  };
  backgroundThreadRpc.registerHandler(queryComponentEndpoint, (url: string) => {
    const ret: ReturnType<RpcCallType<typeof queryComponentEndpoint>> =
      new Promise(resolve => {
        __QueryComponentImpl(url, (result) => {
          resolve({
            code: result.code,
            detail: {
              schema: url,
            },
          });
        });
      });
    return ret;
  });
  return __QueryComponentImpl;
}
