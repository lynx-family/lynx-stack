// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { globalDisallowedVars, globalMuteableVars } from '../constants.js';
import type { LynxTemplate } from '../types/LynxModule.js';

const mainThreadInjectVars = [
  'lynx',
  'globalThis',
  '_ReportError',
  '_SetSourceMapRelease',
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
  '__UpdateComponentInfo',
  '__GetConfig',
  '__GetAttributeByName',
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
  '_I18nResourceTranslation',
  '_AddEventListener',
  '__GetTemplateParts',
  '__MarkPartElement',
  '__MarkTemplateElement',
  '__GetPageElement',
  '__ElementFromBinary',
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

const generateModuleContent = (
  content: string,
  injectVars: readonly string[],
  injectWithBind: readonly string[],
  muteableVars: readonly string[],
  globalDisallowedVars: readonly string[],
  isESM: boolean,
) =>
  [
    '//# allFunctionsCalledOnLoad\n',
    isESM ? 'export default ' : 'globalThis.module.exports =',
    'function(lynx_runtime) {',
    'const module= {exports:{}};let exports = module.exports;',
    'var {',
    injectVars.join(','),
    '} = lynx_runtime;',
    ...injectWithBind.map(nm =>
      `const ${nm} = lynx_runtime.${nm}?.bind(lynx_runtime);`
    ),
    ';var globDynamicComponentEntry = \'__Card__\';',
    globalDisallowedVars.length !== 0
      ? `var ${globalDisallowedVars.join('=')}=undefined;`
      : '',
    'var {__globalProps} = lynx;',
    'lynx_runtime._updateVars=()=>{',
    ...muteableVars.map(nm =>
      `${nm} = lynx_runtime.__lynxGlobalBindingValues.${nm};`
    ),
    '};\n',
    content,
    '\n return module.exports;}',
  ].join('');

async function generateJavascriptUrl<T extends Record<string, string | {}>>(
  obj: T,
  injectVars: string[],
  injectWithBind: string[],
  muteableVars: readonly string[],
  globalDisallowedVars: readonly string[],
  createJsModuleUrl: (content: string, name: string) => Promise<string>,
  isESM: boolean,
  templateName?: string,
): Promise<T> {
  const processEntry = async ([name, content]: [string, string]) => [
    name,
    await createJsModuleUrl(
      generateModuleContent(
        content,
        injectVars.concat(muteableVars),
        injectWithBind,
        muteableVars,
        globalDisallowedVars,
        isESM,
      ),
      `${templateName}-${name.replaceAll('/', '')}.js`,
    ),
  ];
  return Promise.all(
    (Object.entries(obj).filter(([_, content]) =>
      typeof content === 'string'
    ) as [string, string][]).map(processEntry),
  ).then(
    Object.fromEntries,
  );
}

export async function generateTemplate(
  template: LynxTemplate,
  createJsModuleUrl:
    | ((content: string, name: string) => Promise<string>)
    | ((content: string) => string),
  templateName?: string,
): Promise<LynxTemplate> {
  return {
    ...template,
    lepusCode: await generateJavascriptUrl(
      template.lepusCode,
      mainThreadInjectVars,
      [],
      globalMuteableVars,
      templateName ? [] : globalDisallowedVars,
      createJsModuleUrl as (content: string, name: string) => Promise<string>,
      true,
      templateName,
    ),
    manifest: await generateJavascriptUrl(
      template.manifest,
      backgroundInjectVars,
      backgroundInjectWithBind,
      [],
      templateName ? [] : globalDisallowedVars,
      createJsModuleUrl as (content: string, name: string) => Promise<string>,
      false,
      templateName,
    ),
  };
}
