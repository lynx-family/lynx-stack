/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { Cloneable } from './Cloneable.js';

export interface I18nResourceTranslationOptions {
  locale: string;
  channel: string;
  fallback_url?: string;
  [key: string]: Cloneable;
}

export interface CacheI18nResources {
  /** the i18nResource key currently being used by the page */
  curCacheKey: string;
  /** the complete set of all requested i18nResources */
  i18nResources: Map<string, unknown>;
}

export type InitI18nResources = Array<{
  options: I18nResourceTranslationOptions;
  resource: Record<string, unknown>;
}>;

export interface II18nResource {
  data?: Cloneable;
  setData(data: Cloneable): void;
}
