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
} from '../../types/index.js';
import type { BackgroundThread } from './Background.js';
import { i18nResourceMissedEventName } from '../../constants.js';

export const getCacheI18nResourcesKey = (
  options: I18nResourceTranslationOptions,
) => {
  return `${options.locale}_${options.channel}_${options.fallback_url}`;
};

export class I18nManager {
  readonly #background: BackgroundThread;
  readonly #rootDom: ShadowRoot;
  #i18nResources: InitI18nResources;
  constructor(
    background: BackgroundThread,
    rootDom: ShadowRoot,
    i18nResources: InitI18nResources = [],
  ) {
    this.#background = background;
    this.#rootDom = rootDom;
    this.#i18nResources = i18nResources;
  }

  updateData(data: InitI18nResources, options: I18nResourceTranslationOptions) {
    this.#i18nResources = this.#i18nResources.concat(data);
    const matchedInitI18nResources = data.find(i =>
      getCacheI18nResourcesKey(i.options)
        === getCacheI18nResourcesKey(options)
    );
    this.#background.dispatchI18nResource(
      matchedInitI18nResources?.resource as Cloneable,
    );
  }

  _I18nResourceTranslation = (
    options: I18nResourceTranslationOptions,
  ): unknown | undefined => {
    const matchedInitI18nResources = this.#i18nResources?.find((i) =>
      getCacheI18nResourcesKey(i.options)
        === getCacheI18nResourcesKey(options)
    );

    this.#background.dispatchI18nResource(
      matchedInitI18nResources?.resource as Cloneable,
    );

    if (matchedInitI18nResources) {
      return matchedInitI18nResources.resource;
    }

    this.#triggerI18nResourceFallback(options);
    return undefined;
  };

  #triggerI18nResourceFallback(
    options: I18nResourceTranslationOptions,
  ) {
    const event = new CustomEvent(i18nResourceMissedEventName, {
      detail: options as CloneableObject,
    });
    this.#rootDom.dispatchEvent(event);
  }
}
