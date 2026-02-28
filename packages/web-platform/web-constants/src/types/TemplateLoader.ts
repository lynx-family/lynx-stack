import type { LynxTemplate } from './LynxModule.js';

/**
 * @deprecated Use {@link BundleLoader} instead. This alias is retained for
 * backward compatibility.
 */
export type TemplateLoader = (url: string) => Promise<LynxTemplate>;

/**
 * Loads a Lynx Bundle from the given URL.
 *
 * This is the preferred name for the type previously known as
 * {@link TemplateLoader}.
 */
export type BundleLoader = TemplateLoader;
