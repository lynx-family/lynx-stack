import { globalMuteableVars, type LynxTemplate } from '@lynx-js/web-constants';

const templateCache: Map<LynxTemplate, LynxTemplate> = new Map();

function createJsModuleUrl(content: string): string {
  const dataUrl = `data:text/javascript,${encodeURIComponent(content)}`;
  return dataUrl;
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
  '__LoadLepusChunk',
  'SystemInfo',
];

const backgroundInjectVars = [
  'NativeModules',
  'globalThis',
  'lynx',
  'lynxCoreInject',
  'SystemInfo',
];

const backgroundInjectWithBind = [
  'Card',
  'Component',
];

export function loadTemplate(
  rawTemplate: LynxTemplate,
): LynxTemplate {
  const decodedTemplate: LynxTemplate = templateCache.get(rawTemplate) ?? {
    ...rawTemplate,
    lepusCode: generateJavascriptUrl(
      rawTemplate.lepusCode,
      mainThreadInjectVars,
      [],
      globalMuteableVars,
    ),
    manifest: generateJavascriptUrl(
      rawTemplate.manifest,
      backgroundInjectVars,
      backgroundInjectWithBind,
      [],
    ),
  };
  templateCache.set(rawTemplate, decodedTemplate);
  /**
   * This will cause a memory leak, which is expected.
   * We cannot ensure that the `URL.createObjectURL` created url will never be used, therefore here we keep it for the entire lifetime of this page.
   */
  return decodedTemplate;
}
