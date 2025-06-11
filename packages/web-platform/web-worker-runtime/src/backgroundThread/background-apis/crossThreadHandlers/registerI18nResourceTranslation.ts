// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  i18nResourceTranslationEndpoint,
  type I18nResourceTranslationOptions,
} from '@lynx-js/web-constants';
import type { Rpc } from '@lynx-js/web-worker-rpc';

export function registerI18nResourceTranslation(
  { rpc, i18nNapiModule }: {
    rpc: Rpc;
    i18nNapiModule: Record<string, (...args: unknown[]) => void> | undefined;
  },
): void {
  if (!i18nNapiModule) return;
  rpc.registerHandler(
    i18nResourceTranslationEndpoint,
    async (options: I18nResourceTranslationOptions) => {
      const i18nResources = await i18nNapiModule?.['getI18nResourceByNative']?.(
        options,
      );
      return i18nResources;
    },
  );
}
