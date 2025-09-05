import {
  generateTemplate,
  type LynxTemplate,
  type MarkTimingInternal,
  type TemplateLoader,
} from '@lynx-js/web-constants';

const templateCache: Record<string, LynxTemplate> = {};

function createJsModuleUrl(content: string): string {
  return URL.createObjectURL(new Blob([content], { type: 'text/javascript' }));
}

export function createTemplateLoader(
  customTemplateLoader: TemplateLoader | undefined,
  markTimingInternal: MarkTimingInternal,
) {
  const loadTemplate: TemplateLoader = async (
    url: string,
  ) => {
    markTimingInternal('load_template_start');
    const cachedTemplate = templateCache[url];
    if (cachedTemplate) {
      markTimingInternal('load_template_end');
      return cachedTemplate;
    }
    const template = customTemplateLoader
      ? await customTemplateLoader(url)
      : (await (await fetch(url, {
        method: 'GET',
      })).json()) as LynxTemplate;
    const decodedTemplate = await generateTemplate(
      template,
      createJsModuleUrl,
    );
    templateCache[url] = decodedTemplate;
    /**
     * This will cause a memory leak, which is expected.
     * We cannot ensure that the `URL.createObjectURL` created url will never be used, therefore here we keep it for the entire lifetime of this page.
     */
    markTimingInternal('load_template_end');
    return decodedTemplate;
  };
  return loadTemplate;
}
