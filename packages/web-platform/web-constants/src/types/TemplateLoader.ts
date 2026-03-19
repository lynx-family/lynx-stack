import type { LynxBundle } from './LynxModule.js';

/**
 * Loads a Lynx Bundle from the given URL.
 */
export type BundleLoader = (url: string) => Promise<LynxBundle>;

/**
 * @deprecated Use {@link BundleLoader} instead.
 */
export type TemplateLoader = BundleLoader;
