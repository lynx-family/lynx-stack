// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { LynxTemplate } from '../types/LynxModule.js';

const currentSupportedTemplateVersion = 2;
const globalDisallowedVars = ['navigator', 'postMessage', 'window'];
type templateUpgrader = (template: LynxTemplate) => LynxTemplate;
const templateUpgraders: templateUpgrader[] = [
  (template) => {
    template.appType = template.appType ?? (template.lepusCode.root.startsWith(
        '(function (globDynamicComponentEntry',
      )
      ? 'lazy'
      : 'card');
    template.version = 2;
    template.lepusCode = Object.fromEntries(
      Object.entries(template.lepusCode).filter(([_, content]) =>
        typeof content === 'string'
      ),
    ) as typeof template.lepusCode;
    return template;
  },
];

const generateModuleContent = (
  fileName: string,
  content: string,
  eager: boolean,
  appType: 'card' | 'lazy',
) =>
  /**
   * About the `allFunctionsCalledOnLoad` directive:
   * https://v8.dev/blog/preparser#pife
   * https://github.com/WICG/explicit-javascript-compile-hints-file-based?tab=readme-ov-file
   * https://v8.dev/blog/explicit-compile-hints
   * We should ensure the MTS code is parsed eagerly to avoid runtime parse delay.
   * But for BTS code, we should not do this as it would increase the memory usage.
   * JavaScript Engines, like V8, already had optimizations for code starts with "(function"
   * to be parsed eagerly.
   */
  [
    eager ? '//# allFunctionsCalledOnLoad' : '',
    '\n(function() { "use strict"; const ',
    globalDisallowedVars.join('=void 0,'),
    '=void 0;\n',
    appType !== 'card' ? 'module.exports=\n' : '',
    content,
    '\n})()',
    '\n//# sourceURL=',
    fileName,
  ].join('');

async function generateJavascriptUrl<T extends Record<string, string | {}>>(
  obj: T,
  createJsModuleUrl: (content: string, name: string) => Promise<string>,
  eager: boolean,
  appType: 'card' | 'lazy',
  templateName: string,
): Promise<T> {
  return Promise.all(
    (Object.entries(obj).filter(([_, content]) =>
      typeof content === 'string'
    ) as [string, string][]).map(async ([name, content]) => {
      return [
        name,
        await createJsModuleUrl(
          generateModuleContent(
            `${templateName}/${name.replaceAll('/', '_')}.js`,
            content,
            eager,
            appType,
          ),
          `${templateName}-${name.replaceAll('/', '_')}.js`,
        ),
      ];
    }),
  ).then(
    Object.fromEntries,
  );
}

export async function generateTemplate(
  template: LynxTemplate,
  createJsModuleUrl:
    | ((content: string, name: string) => Promise<string>)
    | ((content: string) => string),
  templateName: string,
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
      true,
      template.appType!,
      templateName,
    ),
  };
}
