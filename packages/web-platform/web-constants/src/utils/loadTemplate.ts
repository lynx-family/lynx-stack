import type { LynxTemplate } from '../types/LynxModule.js';
import { generateTemplate } from './generateTemplate.js';

const templateCache: Record<string, LynxTemplate> = {};

function createJsModuleUrl(content: string): string {
  return URL.createObjectURL(new Blob([content], { type: 'text/javascript' }));
}

export async function loadTemplate(
  url: string,
  isLazyComponent = false,
  customTemplateLoader?: (url: string) => Promise<LynxTemplate>,
): Promise<LynxTemplate> {
  const cachedTemplate = templateCache[url];
  if (cachedTemplate) return cachedTemplate;
  const template = customTemplateLoader
    ? await customTemplateLoader(url)
    : (await (await fetch(url, {
      method: 'GET',
    })).json()) as LynxTemplate;
  const decodedTemplate = await generateTemplate({
    template,
    createJsModuleUrl,
    isLazyComponent,
    source: url,
  });
  templateCache[url] = decodedTemplate;
  /**
   * This will cause a memory leak, which is expected.
   * We cannot ensure that the `URL.createObjectURL` created url will never be used, therefore here we keep it for the entire lifetime of this page.
   */
  return decodedTemplate;
}

export const getTemplate = (url: string): LynxTemplate | undefined =>
  templateCache[url];
