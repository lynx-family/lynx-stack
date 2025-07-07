// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { globalMuteableVars } from '../constants.js';
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
  '_I18nResourceTranslation',
  '_AddEventListener',
  '__GetTemplateParts',
  '__MarkPartElement',
  '__MarkTemplateElement',
  '__QueryComponent',
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

async function generateJavascriptUrl<T extends Record<string, string>>(
  options: {
    obj: T;
    injectVars: string[];
    injectWithBind: string[];
    muteableVars: readonly string[];
    createJsModuleUrl: (content: string) => string;
    isDynamicComponent?: boolean;
    isMain: boolean;
    source?: string;
  },
): Promise<T>;
async function generateJavascriptUrl<T extends Record<string, string>>(
  options: {
    obj: T;
    injectVars: string[];
    injectWithBind: string[];
    muteableVars: readonly string[];
    createJsModuleUrl: (content: string, name: string) => Promise<string>;
    templateName: string;
    isDynamicComponent?: boolean;
    isMain: boolean;
    source?: string;
  },
): Promise<T>;
async function generateJavascriptUrl<T extends Record<string, string>>(
  {
    obj,
    injectVars,
    injectWithBind,
    muteableVars,
    createJsModuleUrl,
    templateName,
    isDynamicComponent,
    isMain,
    source,
  }: {
    obj: T;
    injectVars: string[];
    injectWithBind: string[];
    muteableVars: readonly string[];
    createJsModuleUrl:
      | ((content: string) => string)
      | ((content: string, name: string) => Promise<string>);
    templateName?: string;
    isDynamicComponent?: boolean;
    isMain: boolean;
    source?: string;
  },
): Promise<T> {
  injectVars = injectVars.concat(muteableVars);
  const generateModuleContent = (content: string) =>
    [
      '//# allFunctionsCalledOnLoad\n',
      'globalThis.module.exports = function(lynx_runtime) {',
      'const module= {exports:{}};let exports = module.exports;',
      'var {',
      injectVars.join(','),
      '} = lynx_runtime;',
      ...injectWithBind.map(nm =>
        `const ${nm} = lynx_runtime.${nm}?.bind(lynx_runtime);`
      ),
      isDynamicComponent
        ? `;var globDynamicComponentEntry = '${source}';`
        : ';var globDynamicComponentEntry = \'__Card__\';',
      'var {__globalProps} = lynx;',
      'lynx_runtime._updateVars=()=>{',
      ...muteableVars.map(nm =>
        `${nm} = lynx_runtime.__lynxGlobalBindingValues.${nm};`
      ),
      '};\n',
      (isDynamicComponent && isMain) ? `return ${content}` : content,
      '\n return module.exports;}',
    ].join('');
  if (!templateName) {
    createJsModuleUrl;
  }
  const processEntry = templateName
    ? async ([name, content]: [string, string]) => [
      name,
      await (createJsModuleUrl as (
        content: string,
        name: string,
      ) => Promise<string>)(
        generateModuleContent(content),
        `${templateName}-${name.replaceAll('/', '')}.js`,
      ),
    ]
    : async ([name, content]: [string, string]) => [
      name,
      await (createJsModuleUrl as (content: string) => string)(
        generateModuleContent(content),
      ),
    ];
  return Promise.all(Object.entries(obj).map(processEntry)).then(
    Object.fromEntries,
  );
}

export async function generateTemplate(
  options: {
    template: LynxTemplate;
    createJsModuleUrl: (content: string) => string;
    isDynamicComponent: boolean;
    source?: string;
  },
): Promise<LynxTemplate>;
export async function generateTemplate(
  options: {
    template: LynxTemplate;
    createJsModuleUrl: (content: string, name: string) => Promise<string>;
    templateName: string;
    isDynamicComponent: boolean;
    source?: string;
  },
): Promise<LynxTemplate>;
export async function generateTemplate(
  options: {
    template: LynxTemplate;
    createJsModuleUrl:
      | ((content: string) => string)
      | ((content: string, name: string) => Promise<string>);
    templateName?: string;
    isDynamicComponent: boolean;
    source?: string;
  },
): Promise<LynxTemplate> {
  const {
    template,
    createJsModuleUrl,
    templateName,
    isDynamicComponent,
    source,
  } = options;
  if (!templateName) {
    return {
      ...template,
      lepusCode: await generateJavascriptUrl(
        {
          obj: template.lepusCode,
          injectVars: mainThreadInjectVars,
          injectWithBind: [],
          muteableVars: globalMuteableVars,
          createJsModuleUrl: createJsModuleUrl as (content: string) => string,
          isDynamicComponent,
          isMain: true,
          source,
        },
      ),
      manifest: await generateJavascriptUrl(
        {
          obj: template.manifest,
          injectVars: backgroundInjectVars,
          injectWithBind: backgroundInjectWithBind,
          muteableVars: [],
          createJsModuleUrl: createJsModuleUrl as (content: string) => string,
          isDynamicComponent,
          isMain: false,
          source,
        },
      ),
    };
  }

  return {
    ...template,
    lepusCode: await generateJavascriptUrl(
      {
        obj: template.lepusCode,
        injectVars: mainThreadInjectVars,
        injectWithBind: [],
        muteableVars: globalMuteableVars,
        createJsModuleUrl: createJsModuleUrl as (
          content: string,
          name: string,
        ) => Promise<string>,
        templateName,
        isDynamicComponent,
        isMain: true,
        source,
      },
    ),
    manifest: await generateJavascriptUrl(
      {
        obj: template.manifest,
        injectVars: backgroundInjectVars,
        injectWithBind: backgroundInjectWithBind,
        muteableVars: [],
        createJsModuleUrl: createJsModuleUrl as (
          content: string,
          name: string,
        ) => Promise<string>,
        templateName,
        isDynamicComponent,
        isMain: false,
        source,
      },
    ),
  };
}
