// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  getCacheI18nResourcesKey,
  i18nResourceTranslationEndpoint,
  type CacheI18nResources,
  type I18nResourceTranslationOptions,
  type NativeTTObject,
} from '@lynx-js/web-constants';
import type { Rpc } from '@lynx-js/web-worker-rpc';

export function registerI18nResourceTranslation(
  { rpc, tt, i18nNapiModule, cacheI18nResources }: {
    rpc: Rpc;
    tt: NativeTTObject;
    i18nNapiModule: Record<string, (...args: unknown[]) => void> | undefined;
    cacheI18nResources: CacheI18nResources;
  },
): void {
  if (!i18nNapiModule) return;
  rpc.registerHandler(
    i18nResourceTranslationEndpoint,
    async (options: I18nResourceTranslationOptions) => {
      const i18nResources = await i18nNapiModule?.['getI18nResourceByNative']?.(
        options,
      );
      if (i18nResources !== undefined) {
        const cacheKey = getCacheI18nResourcesKey(options);
        cacheI18nResources.i18nResources.set(cacheKey, i18nResources);
        /** locael change, emit onI18nResourceReady */
        if (cacheKey !== cacheI18nResources.curCacheKey) {
          cacheI18nResources.curCacheKey = cacheKey;
          tt.GlobalEventEmitter.emit('onI18nResourceReady', []);
        }
      }
      return i18nResources;
    },
  );
}
