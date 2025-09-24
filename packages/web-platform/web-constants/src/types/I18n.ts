import type { Cloneable } from './Cloneable.js';

export interface I18nResourceTranslationOptions {
  locale: string;
  channel: string;
  fallback_url?: string;
  [key: string]: Cloneable;
}

export const getCacheI18nResourcesKey = (
  options: I18nResourceTranslationOptions,
) => {
  return `${options.locale}_${options.channel}_${options.fallback_url}`;
};

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

export const i18nResourceMissedEventName = 'i18nResourceMissed' as const;

// The purpose of using class is to keep the reference when reassigning
export class I18nResources {
  data?: InitI18nResources;
  constructor(data?: InitI18nResources) {
    this.data = data;
  }
  setData(data: InitI18nResources) {
    this.data = data;
  }
}

// The purpose of using class is to keep the reference when reassigning
export class I18nResource {
  data?: Cloneable;
  constructor(data?: Cloneable) {
    this.data = data;
  }
  setData(data: Cloneable) {
    this.data = data;
  }
}
