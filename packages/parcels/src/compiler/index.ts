// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/** @packageDocumentation Package DSL artifacts for Lynx hosts with Rsbuild. */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { RsbuildPlugin, Rspack } from '@rsbuild/core';

import { getEncodeMode } from '@lynx-js/tasm';
import { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin';
import type { CSS, EncodeOptions } from '@lynx-js/template-webpack-plugin';

import { parcelSections } from '../common/index.js';

/** Scripts and stylesheet rules produced by an artifact compiler. */
export interface ParcelCode {
  /** Native main-thread code that assigns the artifact lifecycle to `module.exports`. */
  main: string;
  /** Optional native background-thread code executed once per loaded artifact. */
  background?: string;
  /** Optional parsed Lynx stylesheet rules, adopted at page scope. */
  style?: readonly CSS.LynxStyleNode[];
}

/** Where Rsbuild writes an artifact's custom sections. */
export type ParcelDelivery =
  | {
    /** Write sections into a host bundle. */
    kind: 'embedded';
    /** Host entry that receives the sections. @defaultValue `'main'` */
    entry?: string;
  }
  | {
    /** Write an independent bundle for the host to fetch. */
    kind: 'external';
    /** Output asset path relative to the Rsbuild distribution directory. */
    filename: string;
  };

/** Configure how a DSL source file becomes a loadable Lynx artifact. */
export interface ParcelPluginOptions {
  /** Path to the compiler input, relative to the Rsbuild project root or absolute. */
  sourcePath: string;
  /** Convert the input file to native scripts and stylesheet rules. */
  compile(source: string): ParcelCode;
  /** Namespace the sections and background module. Use a distinct prefix per artifact on a page. */
  sectionPrefix: string;
  /** Configure where the sections are emitted. @defaultValue Embedded in the `main` entry. */
  delivery?: ParcelDelivery;
  /** Rsbuild environment that generates the Lynx host bundle. @defaultValue `'lynx'` */
  environment?: string;
}

/**
 * Watch and package a DSL artifact as named sections in a host bundle or an external Lynx bundle.
 *
 * @example
 * ```ts
 * import { pluginParcels } from '@lynx-js/parcels/compiler';
 * import { compileLynxXml } from '@lynx-js/parcels/compiler/lynx-xml';
 *
 * const plugin = pluginParcels({
 *   sourcePath: 'ui/card.lynxml',
 *   compile: compileLynxXml,
 *   sectionPrefix: 'card',
 * });
 * ```
 */
export function pluginParcels(
  options: ParcelPluginOptions,
): RsbuildPlugin {
  const {
    sectionPrefix,
    delivery = { kind: 'embedded' },
    environment: environmentName = 'lynx',
  } = options;
  const name = `lynx:parcels:${sectionPrefix}`;
  return {
    name,
    setup(api) {
      const sourcePath = resolve(api.context.rootPath, options.sourcePath);
      api.modifyRspackConfig((config, { environment }) => {
        if (environment.name !== environmentName) return;
        config.plugins ??= [];
        config.plugins.push({
          apply(compiler: Rspack.Compiler) {
            compiler.hooks.thisCompilation.tap(name, compilation => {
              compilation.fileDependencies.add(sourcePath);
              const code = options.compile(readFileSync(sourcePath, 'utf8'));
              const sections = parcelSections(sectionPrefix);
              const customSections: EncodeOptions['customSections'] = {
                [sections.main]: {
                  encoding: 'JsBytecode',
                  content: wrapMainThread(code.main),
                },
                [sections.background]: {
                  content: wrapBackground(
                    sections.background,
                    code.background ?? '',
                  ),
                },
                [sections.css]: {
                  encoding: 'CSS',
                  content: { ruleList: code.style ?? [] },
                },
              };

              if (delivery.kind === 'embedded') {
                const entry = delivery.entry ?? 'main';
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
                          `Duplicate artifact custom section: ${section}`,
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
                const { filename } = delivery;
                if (compilation.getAsset(filename)) {
                  throw new Error(`Duplicate artifact output: ${filename}`);
                }
                const bundle = await encodeExternalBundle(customSections);
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
  var __lynxParcel = true;
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

async function encodeExternalBundle(
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
