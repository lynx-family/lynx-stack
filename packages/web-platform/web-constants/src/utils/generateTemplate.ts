// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { LynxTemplate } from '../types/LynxModule.js';

const currentSupportedTemplateVersion = 2;
const globalDisallowedVars = ['navigator', 'postMessage'];
type templateUpgrader = (template: LynxTemplate) => LynxTemplate;
const templateUpgraders: templateUpgrader[] = [
  (template) => {
    const defaultInjectStr = [
      'Card',
      'setTimeout',
      'setInterval',
      'clearInterval',
      'clearTimeout',
      'NativeModules',
      'Component',
      'ReactLynx',
      'nativeAppId',
      'Behavior',
      'LynxJSBI',
      'lynx',

      // BOM API
      'window',
      'document',
      'frames',
      'location',
      'navigator',
      'localStorage',
      'history',
      'Caches',
      'screen',
      'alert',
      'confirm',
      'prompt',
      'fetch',
      'XMLHttpRequest',
      '__WebSocket__', // We would provide `WebSocket` using `ProvidePlugin`
      'webkit',
      'Reporter',
      'print',
      'global',

      // Lynx API
      'requestAnimationFrame',
      'cancelAnimationFrame',
    ].join(',');
    /**
     * The template version 1 has no module wrapper for bts code
     */
    template.manifest = Object.fromEntries(
      Object.entries(template.manifest).map(([key, value]) => [
        key,
        `{init: (lynxCoreInject) => { var {${defaultInjectStr}} = lynxCoreInject.tt; const module = {exports:null}; ${value}\n return module.exports; } }`,
      ]),
    ) as typeof template.manifest;
    template.lepusCode = Object.fromEntries(
      Object.entries(template.lepusCode).map(([key, value]) => [
        key,
        `(()=>{${value}\n})();`,
      ]),
    ) as typeof template.lepusCode;
    template.version = 2;
    return template;
  },
];

const generateModuleContent = (
  content: string,
) =>
  [
    '//# allFunctionsCalledOnLoad\n',
    '"use strict";\n',
    `(() => {const ${
      globalDisallowedVars.join('=void 0,')
    }=void 0;module.exports = `,
    content,
    '\n})()',
  ].join('');

async function generateJavascriptUrl<T extends Record<string, string | {}>>(
  obj: T,
  createJsModuleUrl: (content: string, name: string) => Promise<string>,
  templateName?: string,
): Promise<T> {
  const processEntry = async ([name, content]: [string, string]) => [
    name,
    await createJsModuleUrl(
      generateModuleContent(
        content,
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
  template.version = template.version ?? 1;
  if (template.version > currentSupportedTemplateVersion) {
    throw new Error(
      `Unsupported template, please upgrade your web-platform dependencies`,
    );
  }
  let upgrader: templateUpgrader | undefined;
  while (
    template.version! < currentSupportedTemplateVersion
    && (upgrader = templateUpgraders[template.version! - 1])
  ) {
    template = upgrader(template);
  }
  return {
    ...template,
    lepusCode: await generateJavascriptUrl(
      template.lepusCode,
      createJsModuleUrl as (content: string, name: string) => Promise<string>,
      templateName,
    ),
    manifest: await generateJavascriptUrl(
      template.manifest,
      createJsModuleUrl as (content: string, name: string) => Promise<string>,
      templateName,
    ),
  };
}
