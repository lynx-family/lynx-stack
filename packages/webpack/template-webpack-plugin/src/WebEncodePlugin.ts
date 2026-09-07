// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Compilation, Compiler } from '@rspack/core';

import type { LynxStyleNode } from '@lynx-js/css-serializer';
import type { TasmJSONInfo } from '@lynx-js/web-core/encode';

import {
  LynxTemplatePlugin,
  isDebug,
  isRsdoctor,
} from './LynxTemplatePlugin.js';
import type { EncodeOptions } from './LynxTemplatePlugin.js';
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
            // `deleteAsset` also deletes everything in `assetInfo.related`, and
            // `related.sourceMap` is where SourceMapDevToolPlugin records the
            // sidecar `.map`. The JS itself is inlined into the template and
            // must go, but its source map is the only way to symbolicate
            // production `/app-service.js` frames, so the map has to outlive it.
            //
            // Without this, `output.sourceMap.js: 'source-map'` and
            // `'hidden-source-map'` both emit no map for the background chunk on
            // the web target, while `'inline-source-map'` works only by
            // embedding the map into the shipped `.web.bundle` (~10x size).
            // rsbuild emits the sidecar in this situation; this makes the web
            // target behave the same.
            //
            // Detaching `related.sourceMap` first does NOT work: `updateAsset`'s
            // info updater does not clear `related` on rspack, so the cascade
            // still fires and the map still disappears. Take a reference to the
            // map before the delete and put it back afterwards instead — that
            // depends on nothing but `emitAsset`.
            const mapName = compilation.getAsset(name)?.info.related?.sourceMap;
            const map = mapName ? compilation.getAsset(mapName) : undefined;
            const mapSource = map?.source;
            const mapInfo = map?.info;

            compilation.deleteAsset(name);

            if (mapName && mapSource && !compilation.getAsset(mapName)) {
              compilation.emitAsset(mapName, mapSource, mapInfo);
            }
          });
          inlinedAssets.clear();
        });

        hooks.beforeEncode.tap({
          name: WebEncodePlugin.name,
          stage: WebEncodePlugin.BEFORE_ENCODE_HOOK_STAGE,
        }, (encodeOptions) => {
          const { encodeData, intermediateAssets } = encodeOptions;

          // A bundle assembled from sections packs every background chunk, so
          // none of them stays on disk. A card keeps its split chunks.
          const inlinedManifest =
            encodeData.sourceContent.appType === 'DynamicComponent'
              ? Object.keys(encodeData.manifest)
              : [last(Object.keys(encodeData.manifest))];

          if (!isDebug() && !isDev && !isRsdoctor()) {
            [
              ...inlinedManifest.map(name =>
                name === undefined ? undefined : { name }
              ),
              encodeData.lepusCode.root,
              ...encodeData.lepusCode.chunks,
              ...encodeData.css.chunks,
              ...intermediateAssets.map((assetName) => ({ name: assetName })),
            ]
              .filter(asset => asset !== undefined)
              .forEach(asset => inlinedAssets.add(asset.name));
          }

          Object.assign(encodeData, {
            cardType: encodeData.sourceContent.dsl.substring(0, 5),
            appType: encodeData.sourceContent.appType,
            pageConfig: {
              ...encodeData.compilerOptions,
              ...encodeData.sourceContent.config,
            },
          });
          return encodeOptions;
        });

        hooks.encode.tapPromise({
          name: WebEncodePlugin.name,
          stage: WebEncodePlugin.ENCODE_HOOK_STAGE,
        }, async ({ encodeOptions }) => {
          // A bundle assembled from custom sections has no `lepusCode`. The
          // web runtime has no section lookup: it reads the main thread from
          // `lepusCode` and the background from `manifest`, so the sections
          // are routed into those slots. A card keeps its fixed entry.
          const slots = encodeOptions.lepusCode === undefined
            ? routeSections(encodeOptions.customSections ?? {})
            : {
              styleInfo: (encodeOptions['css'] as {
                cssMap: Record<string, LynxStyleNode[]>;
              }).cssMap,
              manifest: {
                // `app-service.js` is the entry point of a template.
                '/app-service.js': last(
                  Object.values(
                    encodeOptions.manifest as Record<string, string>,
                  ),
                )!,
              },
              lepusCode: {
                // flatten the lepusCode to a single object
                ...encodeOptions.lepusCode.lepusChunk,
                root: encodeOptions.lepusCode.root!,
              },
              customSections: encodeOptions.customSections ?? {},
            };
          const tasmJSONInfo: Record<string, unknown> = {
            ...slots,
            cardType: encodeOptions['cardType'] as string,
            appType: encodeOptions['appType'] as string,
            pageConfig: encodeOptions['pageConfig'] as Record<string, unknown>,
          };
          if (encodeOptions.elementTemplate !== undefined) {
            tasmJSONInfo['elementTemplate'] = encodeOptions.elementTemplate;
          }
          const isExperimentalWebBinary = process
            .env['EXPERIMENTAL_USE_WEB_BINARY_TEMPLATE'];
          if (
            isExperimentalWebBinary === 'false'
            || isExperimentalWebBinary === '0'
          ) {
            return {
              buffer: Buffer.from(
                JSON.stringify({
                  ...tasmJSONInfo,
                  styleInfo: genStyleInfo(
                    tasmJSONInfo['styleInfo'] as Record<
                      string,
                      LynxStyleNode[]
                    >,
                  ),
                }),
                'utf-8',
              ),
              debugInfo: '',
            };
          } else {
            const { encode } = await import('@lynx-js/web-core/encode');
            return {
              buffer: Buffer.from(encode(tasmJSONInfo as TasmJSONInfo)),
              debugInfo: '',
            };
          }
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

/**
 * Routes the custom sections of a bundle into the slots a web bundle carries.
 * The `JsBytecode` tag says which section is the main thread one; on web it
 * only selects the slot, the section stays raw source.
 *
 * @public
 */
export function routeSections(
  customSections: NonNullable<EncodeOptions['customSections']>,
): Pick<TasmJSONInfo, 'styleInfo' | 'lepusCode' | 'manifest'> & {
  customSections: Record<string, never>;
} {
  const styleInfo: TasmJSONInfo['styleInfo'] = {};
  const lepusCode: TasmJSONInfo['lepusCode'] = {};
  const manifest: TasmJSONInfo['manifest'] = {};
  let cssId = 0;

  for (const [name, section] of Object.entries(customSections)) {
    if (section.encoding === 'CSS') {
      const { ruleList } = section.content as { ruleList?: LynxStyleNode[] };
      // `encodeCSS` requires numeric css-id keys.
      styleInfo[String(cssId++)] = ruleList ?? [];
    } else if (section.encoding === 'JsBytecode') {
      lepusCode[name] = section.content as string;
    } else {
      // Keyed `/<name>` so `readScript` finds it, the way a card carries its
      // own `/app-service.js`.
      manifest[`/${name}`] = section.content as string;
    }
  }

  return { styleInfo, lepusCode, manifest, customSections: {} };
}

function last<T>(array: T[]): T | undefined {
  return array[array.length - 1];
}
