// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/** @packageDocumentation Expose independently instantiated Lynx UI modules with Rsbuild. */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { RsbuildPlugin, Rspack } from '@rsbuild/core';

import { parseLynxXML } from '@lynx-js/lynx-xml/parser';
import type { LynxXMLParseResult } from '@lynx-js/lynx-xml/parser';
import {
  LynxEncodePlugin,
  LynxTemplatePlugin,
} from '@lynx-js/template-webpack-plugin';
import type { EncodeOptions } from '@lynx-js/template-webpack-plugin';

import { parseStylesheet } from './stylesheet.js';
import { islandSections } from '../shared/index.js';

/** Source and parser for one exposed island module.
 * @public
 */
export interface IslandExpose {
  /** Path to the parser input, relative to the Rsbuild project root or absolute. */
  source: string;
  /**
   * Extract main-thread JavaScript, optional background JavaScript, and raw CSS.
   *
   * The main-thread script must export an island module with a `create` factory.
   * @defaultValue The built-in Lynx XML parser.
   */
  parse?(this: void, source: string): LynxXMLParseResult;
}

/** Choose whether island sections belong to the host or a separate resource.
 * @public
 */
export type IslandsOutput =
  | {
    /** Include the sections in the configured host entry. */
    mode: 'inline';
  }
  | {
    /** Emit a separate resource for hosts to load by URL. */
    mode: 'remote';
    /** Asset filename relative to the output directory, such as `cards.lynx.bundle`. */
    filename: string;
  };

/** Configure exposed island modules in a host bundle or a remote resource.
 * @public
 */
export interface IslandsPluginOptions {
  /**
   * Map island names to XML source paths or custom parser configurations.
   * @example
   * ```ts
   * const exposes = {
   *   card: 'ui/card.lynxml',
   * };
   * ```
   */
  exposes: Record<string, string | IslandExpose>;
  /** Host entry that receives the sections. @defaultValue `'main'` */
  entry?: string;
  /**
   * Delivery of all exposed modules.
   * @defaultValue `{ mode: 'inline' }`
   * @example
   * ```ts
   * const output = { mode: 'remote', filename: 'cards.lynx.bundle' };
   * ```
   */
  output?: IslandsOutput;
  /** Rsbuild environment that generates the Lynx host bundle. @defaultValue `'lynx'` */
  environment?: string;
}

/**
 * Watch and package island sections in the host bundle or a separate resource.
 *
 * @example
 * ```ts
 * import { pluginIslands } from '@lynx-js/islands/build';
 *
 * const plugin = pluginIslands({
 *   exposes: {
 *     card: 'ui/card.lynxml',
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
    entry = 'main',
    output = { mode: 'inline' },
    environment: environmentName = 'lynx',
  } = options;
  if (
    Object.keys(exposes).length === 0
    || Object.keys(exposes).some(key => !key.trim())
  ) {
    throw new Error('Islands requires at least one nonempty expose name');
  }
  if (
    output.mode === 'remote'
    && (!output.filename.trim()
      || /[\\:?#[\]]/.test(output.filename)
      || output.filename.split('/').some(part =>
        !part || part === '.' || part === '..'
      ))
  ) {
    throw new Error('Island output filename must be a relative asset path');
  }
  const name = `lynx:islands:${Object.keys(exposes).join(',')}`;
  return {
    name,
    setup(api) {
      const inputs = Object.entries(exposes).map(([expose, input]) => ({
        expose,
        sourcePath: resolve(
          api.context.rootPath,
          typeof input === 'string' ? input : input.source,
        ),
        parse: typeof input === 'string'
          ? parseLynxXML
          : input.parse ?? parseLynxXML,
      }));
      api.modifyRspackConfig((config, { environment }) => {
        if (environment.name !== environmentName) return;
        // A resource-only producer has no JavaScript application entry.
        if (output.mode === 'remote') config.entry ??= {};
        const devReload = api.context.action === 'dev'
          && (environment.config.dev?.hmr !== false
            || environment.config.dev?.liveReload !== false);
        let hotInvalidationModule: string | undefined;
        const entries = config.entry && typeof config.entry === 'object'
            && !Array.isArray(config.entry)
          ? config.entry
          : undefined;
        if (devReload && (output.mode === 'inline' || entries?.[entry])) {
          if (
            !config.entry || typeof config.entry !== 'object'
            || Array.isArray(config.entry)
          ) {
            throw new Error('Islands dev reload requires named object entries');
          }
          const hostEntry = config.entry[entry];
          if (!hostEntry) {
            throw new Error(`Islands cannot find host entry: ${entry}`);
          }
          const description = typeof hostEntry === 'string'
              || Array.isArray(hostEntry)
            ? { import: hostEntry }
            : hostEntry;
          const imports = typeof description.import === 'string'
            ? [description.import]
            : description.import;
          const id = createHash('sha256')
            .update(JSON.stringify([name, entry, environmentName]))
            .digest('hex')
            .slice(0, 16);
          hotInvalidationModule = resolve(
            api.context.rootPath,
            `__lynx-islands.${id}.hot.js`,
          );
          config.entry = {
            ...config.entry,
            [entry]: {
              ...description,
              import: [hotInvalidationModule, ...imports],
            },
          };
        }
        config.plugins ??= [];
        config.plugins.push({
          apply(compiler: Rspack.Compiler) {
            if (hotInvalidationModule) {
              const { experiments } = compiler.webpack;
              let content = renderHotInvalidationModule(inputs);
              const virtualModules = new experiments.VirtualModulesPlugin({
                [hotInvalidationModule]: content,
              });
              virtualModules.apply(compiler);
              compiler.hooks.beforeCompile.tap(name, () => {
                const nextContent = renderHotInvalidationModule(inputs);
                if (nextContent === content) return;
                content = nextContent;
                virtualModules.writeModule(hotInvalidationModule!, content);
                compiler.modifiedFiles = new Set([
                  ...compiler.modifiedFiles ?? [],
                  hotInvalidationModule!,
                ]);
              });
            }
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

              if (output.mode === 'remote') {
                compilation.hooks.processAssets.tapPromise({
                  name,
                  stage:
                    compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
                }, async () => {
                  const { filename } = output;
                  if (compilation.getAsset(filename)) {
                    throw new Error(`Duplicate island output: ${filename}`);
                  }
                  const result = await LynxEncodePlugin.encodePool.run({
                    encodeOptions: {
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
                        targetSdkVersion: '3.7',
                      },
                      sourceContent: {
                        dsl: 'react_nodiff',
                        appType: 'DynamicComponent',
                        config: { lepusStrict: true },
                      },
                      manifest: {},
                      lepusCode: undefined,
                      css: { cssMap: {}, cssSource: {} },
                      customSections,
                    } satisfies EncodeOptions,
                  }) as {
                    status: number;
                    buffer: Uint8Array;
                    error_msg: string;
                  };
                  if (result.status !== 0) throw new Error(result.error_msg);
                  compilation.emitAsset(
                    filename,
                    new compiler.webpack.sources.RawSource(
                      Buffer.from(result.buffer),
                    ),
                  );
                });
                return;
              }

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
            });
          },
        });
      });
    },
  };
}

function renderHotInvalidationModule(
  inputs: Array<{ expose: string; sourcePath: string }>,
): string {
  const hash = createHash('sha256');
  for (const { expose, sourcePath } of inputs) {
    hash.update(expose);
    hash.update('\0');
    hash.update(sourcePath);
    hash.update('\0');
    hash.update(readFileSync(sourcePath));
    hash.update('\0');
  }
  return `// Generated by @lynx-js/islands.
module.exports = ${JSON.stringify(hash.digest('hex'))};
if (module.hot) module.hot.decline();
`;
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
  const hash = createHash('sha256').update(source).digest('hex').slice(0, 16);
  const moduleId = JSON.stringify(`${section}.${hash}.js`);
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
