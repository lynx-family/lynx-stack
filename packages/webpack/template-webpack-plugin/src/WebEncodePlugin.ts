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

// https://github.com/web-infra-dev/rsbuild/blob/main/packages/core/src/types/config.ts#L1029
type InlineChunkTestFunction = (params: {
  size: number;
  name: string;
}) => boolean;
type InlineChunkTest = RegExp | InlineChunkTestFunction;
type InlineChunkConfig = boolean | InlineChunkTest | {
  enable?: boolean | 'auto';
  test: InlineChunkTest;
};

/**
 * The options for WebEncodePluginOptions
 *
 * @public
 */
export interface WebEncodePluginOptions {
  encodeBinary?: string;
  inlineScripts?: InlineChunkConfig | undefined;
}

export class WebEncodePlugin {
  static name = 'WebEncodePlugin';
  static BEFORE_ENCODE_HOOK_STAGE = 100;
  static ENCODE_HOOK_STAGE = 100;

  static defaultOptions: Readonly<Required<WebEncodePluginOptions>> = Object
    .freeze<Required<WebEncodePluginOptions>>({
      encodeBinary: 'napi',
      inlineScripts: true,
    });

  constructor(options: WebEncodePluginOptions = {}) {
    this.options = { ...WebEncodePlugin.defaultOptions, ...options };
  }

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
          const { manifest } = encodeData;
          const styleInfo = genStyleInfo(cssMap);

          const [, content] = last(Object.entries(manifest))!;

          // Determine which assets should be inlined vs external
          const inlinedAssetNames = new Set<string>();
          const externalAssetNames = new Set<string>();

          Object.keys(manifest).forEach(manifestName => {
            const assert = compilation.getAsset(manifestName);
            const shouldInline = this.#shouldInlineScript(
              manifestName,
              assert!.source.size(),
            );

            if (shouldInline) {
              inlinedAssetNames.add(manifestName);
            } else {
              externalAssetNames.add(manifestName);
            }
          });

          if (!isDebug() && !isDev && !isRsdoctor()) {
            [
              // Only add inlined assets to the deletion list
              ...Array.from(inlinedAssetNames).map(name => ({ name })),
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
            pageConfig: {
              ...encodeData.compilerOptions,
              ...encodeData.sourceContent.config,
            },
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
              pageConfig: encodeOptions['pageConfig'],
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

  #shouldInlineScript(name: string, size: number): boolean {
    const inlineConfig = this.options.inlineScripts;

    if (inlineConfig instanceof RegExp) {
      return inlineConfig.test(name);
    }

    if (typeof inlineConfig === 'function') {
      return inlineConfig({ size, name });
    }

    if (typeof inlineConfig === 'object') {
      if (inlineConfig.enable === false) return false;
      if (inlineConfig.test instanceof RegExp) {
        return inlineConfig.test.test(name);
      }
      return inlineConfig.test({ size, name });
    }

    return inlineConfig !== false;
  }

  protected options: Required<WebEncodePluginOptions>;
}

function last<T>(array: T[]): T | undefined {
  return array[array.length - 1];
}
