// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/** @packageDocumentation Expose independently instantiated Lynx UI modules with Rsbuild. */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { RsbuildPlugin, Rspack } from '@rsbuild/core';

import type { LynxXMLParseResult } from '@lynx-js/lynx-xml/parser';
import { getEncodeMode } from '@lynx-js/tasm';
import { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin';
import type { EncodeOptions } from '@lynx-js/template-webpack-plugin';

import { parseStylesheet } from './stylesheet.js';
import { islandSections } from '../shared/index.js';

/**
 * Delivery of island sections, independently of the source's rendering entry.
 *
 * Both modes support rendering in a host container. A standalone page entry,
 * when provided by the source, is separate from this build option.
 * @public
 */
export type IslandsOutput =
  | {
    /** Include sections in the host bundle; this does not inline JavaScript into the source. */
    mode: 'inline';
    /** Host entry that receives the sections. @defaultValue `'main'` */
    entry?: string;
  }
  | {
    /** Emit a separate bundle that the host loads by URL; it is not a standalone page. */
    mode: 'remote';
    /** Output asset path relative to the Rsbuild distribution directory. */
    filename: string;
  };

/** Source and parser for one exposed island module.
 * @public
 */
export interface IslandExpose {
  /** Path to the parser input, relative to the Rsbuild project root or absolute. */
  source: string;
  /**
   * Extract main-thread JavaScript, optional background JavaScript, and raw CSS.
   *
   * Pass `parseLynxXML` from `@lynx-js/lynx-xml/parser` for Lynx XML sources.
   * The main-thread script must export an island module with a `create` factory.
   */
  parse(this: void, source: string): LynxXMLParseResult;
}

/** Configure exposed island modules and their output bundle.
 * @public
 */
export interface IslandsPluginOptions {
  /**
   * Map public module names to their source and parser.
   * @example
   * ```ts
   * const exposes = {
   *   card: { source: 'ui/card.lynxml', parse: parseLynxXML },
   * };
   * ```
   */
  exposes: Record<string, IslandExpose>;
  /** Configure delivery of all exposed sections. @defaultValue Inline in the `main` entry. */
  output?: IslandsOutput;
  /** Rsbuild environment that generates the Lynx host bundle. @defaultValue `'lynx'` */
  environment?: string;
}

/**
 * Watch and package island sections in the host bundle or a separate remote bundle.
 *
 * @example
 * ```ts
 * import { pluginIslands } from '@lynx-js/islands/build';
 * import { parseLynxXML } from '@lynx-js/lynx-xml/parser';
 *
 * const plugin = pluginIslands({
 *   exposes: {
 *     card: { source: 'ui/card.lynxml', parse: parseLynxXML },
 *   },
 * });
 * ```
 * @public
 */
export function pluginIslands(
  options: IslandsPluginOptions,
): RsbuildPlugin {
  const {
    exposes,
    output = { mode: 'inline' },
    environment: environmentName = 'lynx',
  } = options;
  if (
    Object.keys(exposes).length === 0
    || Object.keys(exposes).some(key => !key.trim())
  ) {
    throw new Error('Islands requires at least one nonempty expose name');
  }
  const name = `lynx:islands:${Object.keys(exposes).join(',')}`;
  return {
    name,
    setup(api) {
      const inputs = Object.entries(exposes).map(([expose, input]) => ({
        expose,
        sourcePath: resolve(api.context.rootPath, input.source),
        parse: input.parse,
      }));
      api.modifyRspackConfig((config, { environment }) => {
        if (environment.name !== environmentName) return;
        config.plugins ??= [];
        config.plugins.push({
          apply(compiler: Rspack.Compiler) {
            compiler.hooks.thisCompilation.tap(name, compilation => {
              const customSections: EncodeOptions['customSections'] = {};
              for (const { expose, sourcePath, parse } of inputs) {
                compilation.fileDependencies.add(sourcePath);
                const parsed = parse(readFileSync(sourcePath, 'utf8'));
                if (!parsed.success) {
                  throw new Error(
                    `${sourcePath}: ${parsed.error.formattedMessage}`,
                  );
                }
                const sections = islandSections(expose);
                customSections[sections.main] = {
                  encoding: 'JsBytecode',
                  content: wrapMainThread(parsed.mainThreadScript),
                };
                customSections[sections.background] = {
                  content: wrapBackground(
                    sections.background,
                    parsed.backgroundThreadScript ?? '',
                  ),
                };
                customSections[sections.css] = {
                  encoding: 'CSS',
                  content: {
                    ruleList: parseStylesheet(parsed.style, sourcePath),
                  },
                };
              }

              if (output.mode === 'inline') {
                const entry = output.entry ?? 'main';
                LynxTemplatePlugin.getLynxTemplatePluginHooks(compilation)
                  .beforeEncode.tap(name, args => {
                    if (!args.chunkGroups.some(group => group.name === entry)) {
                      return args;
                    }
                    for (const section of Object.keys(customSections)) {
                      if (
                        Object.prototype.hasOwnProperty.call(
                          args.encodeData.customSections,
                          section,
                        )
                      ) {
                        throw new Error(
                          `Duplicate island custom section: ${section}`,
                        );
                      }
                    }
                    Object.assign(
                      args.encodeData.customSections,
                      customSections,
                    );
                    return args;
                  });
                return;
              }

              compilation.hooks.processAssets.tapPromise({
                name,
                stage:
                  compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
              }, async () => {
                const { filename } = output;
                if (compilation.getAsset(filename)) {
                  throw new Error(`Duplicate island output: ${filename}`);
                }
                const bundle = await encodeRemoteBundle(customSections);
                compilation.emitAsset(
                  filename,
                  new compiler.webpack.sources.RawSource(bundle),
                );
              });
            });
          },
        });
      });
    },
  };
}

// Native loadScript evaluates the section and returns the CommonJS exports.
function wrapMainThread(source: string): string {
  return `(function () {
  var globDynamicComponentEntry = '__Card__';
  var __lynxIsland = true;
  const module = { exports: {} };
  const exports = module.exports;
${source}
  return module.exports;
})()`;
}

// Match the native ReturnByFunction + tt.define convention so Lynx injects its
// background-thread APIs into the artifact module.
function wrapBackground(section: string, source: string): string {
  const moduleId = JSON.stringify(`${section}.js`);
  return `(function () {
    function init(lynxCoreInject) {
      const tt = lynxCoreInject.tt;
      tt.define(${moduleId}, function(require, module, exports,
        Card, setTimeout, setInterval, clearInterval, clearTimeout, NativeModules,
        tt, console, Component, ReactLynx, nativeAppId, Behavior, LynxJSBI, lynx) {
${source}
      });
      return tt.require(${moduleId});
    }
    const result = { init };
    globalThis.__bundle__holder = result;
    return result;
  })()`;
}

async function encodeRemoteBundle(
  customSections: EncodeOptions['customSections'],
): Promise<Buffer> {
  const result = await getEncodeMode()({
    compilerOptions: {
      enableFiberArch: true,
      useLepusNG: true,
      enableReuseContext: true,
      bundleModuleMode: 'ReturnByFunction',
      debugInfoOutside: true,
      defaultDisplayLinear: false,
      defaultOverflowVisible: false,
      enableCSSInvalidation: true,
      enableCSSSelector: true,
      enableRemoveCSSScope: true,
      targetSdkVersion: '3.5',
    },
    sourceContent: {
      // The native container format uses this card type to load sections.
      dsl: 'react',
      appType: 'DynamicComponent',
      config: { lepusStrict: true },
    },
    manifest: {},
    lepusCode: undefined,
    css: { cssMap: {}, cssSource: {} },
    customSections,
  });
  if (result.status !== 0) throw new Error(result.error_msg);
  return result.buffer;
}
