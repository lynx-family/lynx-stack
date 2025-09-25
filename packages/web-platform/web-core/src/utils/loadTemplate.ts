import {
  generateTemplate,
  type LynxTemplate,
  type MarkTimingInternal,
  type TemplateLoader,
} from '@lynx-js/web-constants';

const templateCache: Map<string, Promise<LynxTemplate> | LynxTemplate> =
  new Map();

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
    const cachedTemplate = templateCache.get(url);
    if (cachedTemplate) {
      markTimingInternal('load_template_end');
      return cachedTemplate;
    } else {
      const promise = new Promise<LynxTemplate>(async (resolve, reject) => {
        try {
          const template = customTemplateLoader
            ? await customTemplateLoader(url)
            : (await (await fetch(url, {
              method: 'GET',
            })).json()) as LynxTemplate;
          const decodedTemplate = await generateTemplate(
            template,
            createJsModuleUrl,
            encodeURIComponent(url),
          );
          resolve(decodedTemplate);
        } catch (e) {
          templateCache.delete(url);
          reject(e);
        }
      });
      templateCache.set(url, promise);
      /**
       * This will cause a memory leak, which is expected.
       * We cannot ensure that the `URL.createObjectURL` created url will never be used, therefore here we keep it for the entire lifetime of this page.
       */
      markTimingInternal('load_template_end');
      return promise;
    }
  };
  return loadTemplate;
}
