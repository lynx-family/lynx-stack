/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {
  Cloneable,
  CloneableObject,
  I18nResourceTranslationOptions,
  InitI18nResources,
} from '@types';
import type { BackgroundThread } from './Background.js';
import { i18nResourceMissedEventName } from '@constants';

export const getCacheI18nResourcesKey = (
  options: I18nResourceTranslationOptions,
) => {
  return `${options.locale}_${options.channel}_${options.fallback_url}`;
};

export class I18nManager {
  constructor(
    private readonly background: BackgroundThread,
    private readonly rootDom: ShadowRoot,
    private i18nResources: InitI18nResources = [],
  ) {
  }

  setData(data: InitI18nResources) {
    this.i18nResources = this.i18nResources.concat(data);
  }

  _I18nResourceTranslation = (
    options: I18nResourceTranslationOptions,
  ): unknown | undefined => {
    const matchedInitI18nResources = this.i18nResources?.find((i) =>
      getCacheI18nResourcesKey(i.options)
        === getCacheI18nResourcesKey(options)
    );

    this.background.dispatchI18nResource(
      matchedInitI18nResources?.resource as Cloneable,
    );

    if (matchedInitI18nResources) {
      return matchedInitI18nResources.resource;
    }

    this.triggerI18nResourceFallback(options);
    return undefined;
  };

  private triggerI18nResourceFallback(
    options: I18nResourceTranslationOptions,
  ) {
    const event = new CustomEvent(i18nResourceMissedEventName, {
      detail: options as CloneableObject,
    });
    this.rootDom.dispatchEvent(event);
  }
}
