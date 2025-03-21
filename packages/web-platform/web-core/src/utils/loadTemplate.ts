import { globalMuteableVars, type LynxTemplate } from '@lynx-js/web-constants';

const TemplateCache: Record<string, LynxTemplate> = {};

function createJsModuleUrl(content: string): string {
  return URL.createObjectURL(new Blob([content], { type: 'text/javascript' }));
}

function generateJavascriptUrl<T extends Record<string, string>>(
  obj: T,
  injectVars: string[],
  injectWithBind: string[],
  muteableVars: readonly string[],
) {
  injectVars = injectVars.concat(muteableVars);
  return Object.fromEntries(
    Object.entries(obj).map(([name, content]) => {
      return [
        name,
        createJsModuleUrl(
          [
            'globalThis.module.exports = function(lynx_runtime) {',
            'const module= {exports:{}};let exports = module.exports;',
            'var {',
            injectVars.join(','),
            '} = lynx_runtime;',
            ...injectWithBind.map((nm) =>
              `const ${nm} = lynx_runtime.${nm}?.bind(lynx_runtime);`
            ),
            ';var globDynamicComponentEntry = \'__Card__\';',
            'var {__globalProps} = lynx;',
            'lynx_runtime._updateVars=()=>{',
            ...muteableVars.map((nm) =>
              `${nm} = lynx_runtime.__lynxGlobalBindingValues.${nm};`
            ),
            '};\n',
            content,
            '\n return module.exports;}',
          ].join(''),
        ),
      ];
    }),
  ) as T;
}

const mainThreadInjectVars = [
  'lynx',
  'globalThis',
  '_ReportError',
  '__AddConfig',
  '__AddDataset',
  '__GetAttributes',
  '__GetComponentID',
  '__GetDataByKey',
  '__GetDataset',
  '__GetElementConfig',
  '__GetElementUniqueID',
  '__GetID',
  '__GetTag',
  '__SetAttribute',
  '__SetConfig',
  '__SetDataset',
  '__SetID',
  '__UpdateComponentID',
  '__GetConfig',
  '__UpdateListCallbacks',
  '__AppendElement',
  '__ElementIsEqual',
  '__FirstElement',
  '__GetChildren',
  '__GetParent',
  '__InsertElementBefore',
  '__LastElement',
  '__NextElement',
  '__RemoveElement',
  '__ReplaceElement',
  '__ReplaceElements',
  '__SwapElement',
  '__CreateComponent',
  '__CreateElement',
  '__CreatePage',
  '__CreateView',
  '__CreateText',
  '__CreateRawText',
  '__CreateImage',
  '__CreateScrollView',
  '__CreateWrapperElement',
  '__CreateList',
  '__AddEvent',
  '__GetEvent',
  '__GetEvents',
  '__SetEvents',
  '__AddClass',
  '__SetClasses',
  '__GetClasses',
  '__AddInlineStyle',
  '__SetInlineStyles',
  '__SetCSSId',
  '__OnLifecycleEvent',
  '__FlushElementTree',
];

const backgroundInjectVars = [
  'NativeModules',
  'globalThis',
  'lynx',
  'lynxCoreInject',
];

const backgroundInjectWithBind = [
  'Card',
  'Component',
];

export async function loadTemplate(url: string): Promise<LynxTemplate> {
  const cachedTemplate = TemplateCache[url];
  if (cachedTemplate) return cachedTemplate;
  const template = (await (await fetch(url, {
    method: 'GET',
  })).json()) as LynxTemplate;
  const decodedTemplate: LynxTemplate = {
    ...template,
    lepusCode: generateJavascriptUrl(
      template.lepusCode,
      mainThreadInjectVars,
      [],
      globalMuteableVars,
    ),
    manifest: generateJavascriptUrl(
      template.manifest,
      backgroundInjectVars,
      backgroundInjectWithBind,
      [],
    ),
  };
  TemplateCache[url] = decodedTemplate;
  /**
   * This will cause a memory leak, which is expected.
   * We cannot ensure that the `URL.createObjectURL` created url will never be used, therefore here we keep it for the entire lifetime of this page.
   */
  return decodedTemplate;
}
