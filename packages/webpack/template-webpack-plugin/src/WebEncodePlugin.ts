// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Compilation, Compiler } from 'webpack';

import {
  LynxTemplatePlugin,
  isDebug,
  isRsdoctor,
} from './LynxTemplatePlugin.js';
import { genStyleInfo } from './web/genStyleInfo.js';

export class WebEncodePlugin {
  static name = 'WebEncodePlugin';
  static BEFORE_ENCODE_HOOK_STAGE = 100;
  static ENCODE_HOOK_STAGE = 100;

  apply(compiler: Compiler): void {
    const isDev = process.env['NODE_ENV'] === 'development'
      || compiler.options.mode === 'development';

    compiler.hooks.thisCompilation.tap(
      WebEncodePlugin.name,
      (compilation) => {
        const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(
          compilation,
        );

        const inlinedAssets = new Set<string>();

        const { Compilation } = compiler.webpack;
        compilation.hooks.processAssets.tap({
          name: WebEncodePlugin.name,

          // `PROCESS_ASSETS_STAGE_REPORT` is the last stage of the `processAssets` hook.
          // We need to run our asset deletion after this stage to ensure all assets have been processed.
          // E.g.: upload source-map to sentry.
          stage: Compilation.PROCESS_ASSETS_STAGE_REPORT + 1,
        }, () => {
          inlinedAssets.forEach((name) => {
            compilation.deleteAsset(name);
          });
          inlinedAssets.clear();
        });

        hooks.beforeEncode.tap({
          name: WebEncodePlugin.name,
          stage: WebEncodePlugin.BEFORE_ENCODE_HOOK_STAGE,
        }, (encodeOptions) => {
          const { encodeData } = encodeOptions;
          const { cssMap } = encodeData.css;
          const styleInfo = genStyleInfo(cssMap);

          const [name, content] = last(Object.entries(encodeData.manifest))!;

          if (!isDebug() && !isDev && !isRsdoctor()) {
            [
              { name },
              encodeData.lepusCode.root,
              ...encodeData.lepusCode.chunks,
              ...encodeData.css.chunks,
            ]
              .filter(asset => asset !== undefined)
              .forEach(asset => inlinedAssets.add(asset.name));
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
          name: WebEncodePlugin.name,
          stage: WebEncodePlugin.ENCODE_HOOK_STAGE,
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

function last<T>(array: T[]): T | undefined {
  return array[array.length - 1];
}
