// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Compilation, Compiler } from 'webpack';

import { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin';

import { genStyleInfo } from './style/genStyleInfo.js';

export class WebWebpackPlugin {
  static name = 'lynx-for-web-plugin';
  static BEFORE_ENCODE_HOOK_STAGE = 100;
  static ENCODE_HOOK_STAGE = 100;

  apply(compiler: Compiler): void {
    const isDev = process.env['NODE_ENV'] === 'development'
      || compiler.options.mode === 'development';

    compiler.hooks.thisCompilation.tap(
      WebWebpackPlugin.name,
      (compilation) => {
        const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(
          compilation,
        );
        hooks.beforeEncode.tap({
          name: WebWebpackPlugin.name,
          stage: WebWebpackPlugin.BEFORE_ENCODE_HOOK_STAGE,
        }, (encodeOptions) => {
          const { encodeData } = encodeOptions;
          const { cssMap } = encodeData.css;
          const styleInfo = genStyleInfo(cssMap);

          const [name, content] = last(Object.entries(encodeData.manifest))!;

          if (!isDebug() && !isDev && !isRsdoctor()) {
            compiler.hooks.emit.tap({ name: WebWebpackPlugin.name }, () => {
              this.deleteDebuggingAssets(compilation, [
                { name },
                encodeData.lepusCode.root,
                ...encodeData.lepusCode.chunks,
                ...encodeData.css.chunks,
              ]);
            });
          }

          Object.assign(encodeData, {
            styleInfo,
            manifest: {
              // `app-service.js` is the entry point of a template.
              '/app-service.js': content,
            },
            customSections: encodeData.customSections,
            cardType: encodeData.sourceContent.dsl.substring(0, 5),
            pageConfig: encodeData.compilerOptions,
          });
          return encodeOptions;
        });

        hooks.encode.tap({
          name: WebWebpackPlugin.name,
          stage: WebWebpackPlugin.ENCODE_HOOK_STAGE,
        }, ({ encodeOptions }) => {
          return {
            buffer: Buffer.from(JSON.stringify({
              styleInfo: encodeOptions['styleInfo'],
              manifest: encodeOptions.manifest,
              cardType: encodeOptions['cardType'],
              pageConfig: encodeOptions.compilerOptions,
              lepusCode: {
                // flatten the lepusCode to a single object
                ...encodeOptions.lepusCode.lepusChunk,
                root: encodeOptions.lepusCode.root,
              },
              customSections: encodeOptions.customSections,
            })),
            debugInfo: '',
          };
        });
      },
    );
  }

  /**
   * The deleteDebuggingAssets delete all the assets that are inlined into the template.
   */
  deleteDebuggingAssets(
    compilation: Compilation,
    assets: ({ name: string } | undefined)[],
  ): void {
    assets
      .filter(asset => asset !== undefined)
      .forEach(asset => deleteAsset(asset));
    function deleteAsset({ name }: { name: string }) {
      return compilation.deleteAsset(name);
    }
  }
}

export function isDebug(): boolean {
  if (!process.env['DEBUG']) {
    return false;
  }

  const values = process.env['DEBUG'].toLocaleLowerCase().split(',');
  return [
    'rspeedy',
    '*',
    'rspeedy:*',
    'rspeedy:template',
  ].some((key) => values.includes(key));
}

export function isRsdoctor(): boolean {
  return process.env['RSDOCTOR'] === 'true';
}

function last<T>(array: T[]): T | undefined {
  return array[array.length - 1];
}
