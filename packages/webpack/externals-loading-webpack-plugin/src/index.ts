// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @packageDocumentation
 *
 * A webpack plugin to load externals in Lynx. Use `lynx.fetchBundle()` and `lynx.loadScript()` API to load and parse the externals.
 *
 * @remarks
 * Requires Lynx version 3.5 or later.
 */

import type {
  Compiler,
  ExternalItemFunctionData,
  ExternalItemValue,
  ExternalsType,
} from '@rspack/core';

/**
 * The options of the `ExternalsLoadingPlugin`.
 *
 * @public
 */
export interface ExternalsLoadingPluginOptions {
  /**
   * The name of the main thread layer.
   */
  mainThreadLayer: string;

  /**
   * The name of the background layer.
   */
  backgroundLayer: string;

  /**
   * Specify the externals to be loaded. The externals should be Lynx Bundles.
   *
   * @example
   *
   * Load `lodash` library in background layer and `main-thread` layer.
   *
   * ```js
   * module.exports = {
   *  plugins: [
   *    new ExternalsLoadingPlugin({
   *      externals: {
   *        lodash: {
   *          url: 'http://lodash.lynx.bundle',
   *          background: { sectionPath: 'background' },
   *          mainThread: { sectionPath: 'mainThread' },
   *        },
   *      },
   *    }),
   *  ],
   * };
   * ```
   *
   * @example
   *
   * Load `lodash` library only in background layer.
   *
   * ```js
   * module.exports = {
   *  plugins: [
   *    new ExternalsLoadingPlugin({
   *      externals: {
   *        lodash: {
   *          url: 'http://lodash.lynx.bundle',
   *          background: { sectionPath: 'background' }
   *        },
   *      },
   *    }),
   *  ],
   * };
   * ```
   */
  externals: Record<
    string,
    ExternalValue
  >;
  /**
   * This option indicates what global object will be used to mount the library.
   *
   * In Lynx, the library will be mounted to `lynx[Symbol.for("__LYNX_EXTERNAL_GLOBAL__")]` by default.
   *
   * If you have enabled share js context and want to reuse the library by mounting to the global object, you can set this option to `'globalThis'`.
   *
   * @default 'lynx'
   */
  globalObject?: 'lynx' | 'globalThis' | undefined;
}

/**
 * The value item of the externals.
 *
 * @public
 */
export interface ExternalValue {
  /**
   * The final bundle URL to fetch directly at runtime.
   *
   * Use this when the external bundle is hosted outside the current build
   * output, such as on a CDN. If both `url` and `bundlePath` are provided,
   * `url` takes precedence because it is already the fully resolved address.
   */
  url?: string;

  /**
   * The bundle path resolved against the runtime public path.
   *
   * Prefer this over `url` when the bundle should follow the active
   * `publicPath`. The runtime will load it with `publicPath + bundlePath`,
   * which keeps external bundle resolution aligned with the current build
   * output without hard-coding an absolute URL into the generated runtime code.
   */
  bundlePath?: string;

  /**
   * The name of the library. Same as https://webpack.js.org/configuration/externals/#string.
   *
   * By default, the library name is the same as the externals key. For example:
   *
   * The config
   *
   * ```js
   * ExternalsLoadingPlugin({
   *   externals: {
   *     lodash: {
   *       url: '……',
   *     }
   *   }
   * })
   * ```
   *
   * Will generate the following webpack externals config:
   *
   * ```js
   * externals: {
   *   lodash: 'lynx[Symbol.for("__LYNX_EXTERNAL_GLOBAL__")].lodash',
   * }
   * ```
   *
   * If one external bundle contains multiple modules, should set the same library name to ensure it's loaded only once. For example:
   *
   * ```js
   * ExternalsLoadingPlugin({
   *   externals: {
   *     lodash: {
   *       libraryName: 'Lodash',
   *       url: '……',
   *     },
   *     'lodash-es': {
   *       libraryName: 'Lodash',
   *       url: '……',
   *     }
   *   }
   * })
   * ```
   * Will generate the following webpack externals config:
   *
   * ```js
   * externals: {
   *   lodash: 'lynx[Symbol.for("__LYNX_EXTERNAL_GLOBAL__")].Lodash',
   *   'lodash-es': 'lynx[Symbol.for("__LYNX_EXTERNAL_GLOBAL__")].Lodash',
   * }
   * ```
   *
   * You can pass an array to specify subpath of the external. Same as https://webpack.js.org/configuration/externals/#string-1. For example:
   *
   * ```js
   * ExternalsLoadingPlugin({
   *   externals: {
   *     preact: {
   *       libraryName: ['ReactLynx', 'Preact'],
   *       url: '……',
   *     },
   *   }
   * })
   * ```
   *
   * Will generate the following webpack externals config:
   *
   * ```js
   * externals: {
   *   preact: 'lynx[Symbol.for("__LYNX_EXTERNAL_GLOBAL__")].ReactLynx.Preact',
   * }
   * ```
   *
   * @defaultValue `undefined`
   *
   * @example `Lodash`
   */
  libraryName?: string | string[];

  /**
   * Whether the source should be loaded asynchronously or not.
   *
   * @defaultValue `true`
   */
  async?: boolean;

  /**
   * The options of the background layer.
   *
   * @defaultValue `undefined`
   */
  background?: LayerOptions;

  /**
   * The options of the main-thread layer.
   *
   * @defaultValue `undefined`
   */
  mainThread?: LayerOptions;

  /**
   * The wait time in milliseconds.
   *
   * @defaultValue `2000`
   */
  timeout?: number;
}

/**
 * The options of the background or main-thread layer.
 *
 * @public
 */
export interface LayerOptions {
  /**
   * The path in `customSections`.
   */
  sectionPath: string;
}

function getLynxExternalGlobal(globalObject?: string) {
  return `${globalObject ?? 'lynx'}[Symbol.for('__LYNX_EXTERNAL_GLOBAL__')]`;
}

function validateExternals(externals: Record<string, ExternalValue>): void {
  for (const [request, external] of Object.entries(externals)) {
    if (external.url || external.bundlePath) {
      continue;
    }

    throw new Error(
      `ExternalsLoadingPlugin requires \`url\` or \`bundlePath\` for external "${request}".`,
    );
  }
}

/**
 * The webpack plugin to load lynx external bundles.
 *
 * @example
 * ```js
 * // webpack.config.js
 * import { ExternalsLoadingPlugin } from '@lynx-js/externals-loading-webpack-plugin';
 *
 * export default {
 *   plugins: [
 *     new ExternalsLoadingPlugin({
 *       mainThreadLayer: 'main-thread',
 *       backgroundLayer: 'background',
 *       mainThreadChunks: ['index__main-thread'],
 *       backgroundChunks: ['index'],
 *       externals: {
 *        'lodash': {
 *          url: 'http://lodash.lynx.bundle',
 *          async: true,
 *          background: {
 *            sectionPath: 'background',
 *          },
 *          mainThread: {
 *            sectionPath: 'mainThread',
 *          },
 *        },
 *       }
 *     })
 *   ]
 * }
 * ```
 *
 * @public
 */
export class ExternalsLoadingPlugin {
  constructor(private options: ExternalsLoadingPluginOptions) {
    validateExternals(this.options.externals);
  }

  apply(compiler: Compiler): void {
    const { RuntimeModule } = compiler.webpack;

    const externalsLoadingPluginOptions = this.options;
    const externals = externalsLoadingPluginOptions.externals ?? {};

    class ExternalsLoadingRuntimeModule extends RuntimeModule {
      constructor(
        public runtimeRequirements: Set<string>,
        private options: { layer: string },
      ) {
        super(
          'externals-loading-runtime',
          RuntimeModule.STAGE_TRIGGER,
        );
        this.runtimeRequirements = runtimeRequirements;
      }

      override generate() {
        if (!this.chunk?.name || !externals) {
          return '';
        }
        return this.#genExternalsLoadingCode(this.options.layer);
      }

      #genExternalsLoadingCode(
        chunkLayer: string,
      ): string {
        const url2fetchCode: Map<string, string> = new Map();
        const loadCode: Set<string> = new Set();
        // filter duplicate externals by libraryName or package name to avoid loading the same external multiple times. We keep the last one.
        const externalsMap = new Map<
          string | string[],
          ExternalsLoadingPluginOptions['externals'][string]
        >();
        let layer: 'background' | 'mainThread';
        if (chunkLayer === externalsLoadingPluginOptions.backgroundLayer) {
          layer = 'background';
        } else if (
          chunkLayer === externalsLoadingPluginOptions.mainThreadLayer
        ) {
          layer = 'mainThread';
        } else {
          return '';
        }
        const isMainThreadLayer = layer === 'mainThread';
        for (
          const [pkgName, external] of Object.entries(
            externals,
          )
        ) {
          externalsMap.set(external.libraryName ?? pkgName, external);
        }
        const finalExternals = Array.from(externalsMap.entries());

        if (finalExternals.length === 0) {
          return '';
        }
        const lynxExternalGlobal = getLynxExternalGlobal(
          externalsLoadingPluginOptions.globalObject,
        );
        const runtimeGlobalsInit =
          `${lynxExternalGlobal} = ${lynxExternalGlobal} === undefined ? {} : ${lynxExternalGlobal};`;
        const loadExternalFunc = `
function createLoadExternalAsync(handler, sectionPath) {
  return new Promise((resolve, reject) => {
    handler.then((response) => {
      if (response.code === 0) {
        try {
          const result = lynx.loadScript(sectionPath, { bundleName: response.url });
          ${
          isMainThreadLayer
            ? `
          // TODO: Use configured layer suffix instead of hard-coded __main-thread for CSS section lookup.
          if (typeof __LoadStyleSheet === 'function') {
            const styleSheet = __LoadStyleSheet(sectionPath.replace('__main-thread', '') + ':CSS', response.url);
            if (styleSheet !== null) {
              __AdoptStyleSheet(styleSheet);
              __FlushElementTree();
            }
          } else {
            console.warn('__LoadStyleSheet is not defined. Failed to load CSS for ' + sectionPath + ' in ' + response.url + '. __LoadStyleSheet is only available in LynxSDK >= 3.7');
          }
            `
            : ''
        }
          resolve(result)
        } catch (error) {
          console.error(error)
          reject(new Error('Failed to load script ' + sectionPath + ' in ' + response.url, { cause: error }))
        }
      } else {
        reject(new Error('Failed to fetch external source ' + response.url + ' . The response is ' + JSON.stringify(response), { cause: response }));
      }
    })
  })
}

function createLoadExternalSync(handler, sectionPath, timeout) {
  const response = handler.wait(timeout)
  if (response.code === 0) {
    try  {
      const result = lynx.loadScript(sectionPath, { bundleName: response.url });
      ${
          isMainThreadLayer
            ? `
      // TODO: Use configured layer suffix instead of hard-coded __main-thread for CSS section lookup.
      if (typeof __LoadStyleSheet === 'function') {
        const styleSheet = __LoadStyleSheet(sectionPath.replace('__main-thread', '') + ':CSS', response.url);
        if (styleSheet !== null) {
          __AdoptStyleSheet(styleSheet);
          __FlushElementTree();
        }
      } else {
        console.warn('__LoadStyleSheet is not defined. Failed to load CSS for ' + sectionPath + ' in ' + response.url + '. __LoadStyleSheet is only available in LynxSDK >= 3.7');
      }
          `
            : ''
        }
      return result
    } catch (error) {
      console.error(error)
      throw new Error('Failed to load script ' + sectionPath + ' in ' + response.url, { cause: error })
    }
  } else {
    throw new Error('Failed to fetch external source ' + response.url + ' . The response is ' + JSON.stringify(response), { cause: response })
  }
}
`;

        const hasUrlLibraryNamePairInjected = new Set();

        for (const [pkgName, external] of finalExternals) {
          const {
            libraryName,
            url,
            bundlePath,
            async = true,
            timeout: timeoutInMs = 2000,
          } = external;
          const layerOptions = external[layer];
          // Lynx fetchBundle timeout is in seconds
          const timeout = timeoutInMs / 1000;

          if (!layerOptions?.sectionPath) {
            continue;
          }

          const libraryNameWithDefault = libraryName ?? pkgName;
          const libraryNameStr = Array.isArray(libraryNameWithDefault)
            ? libraryNameWithDefault[0]
            : libraryNameWithDefault;

          const normalizedExternal = bundlePath
            ? {
              ...external,
              bundlePath: bundlePath.replace(/^\/+/, ''),
            }
            : external;
          const urlKey = url ?? `bundlePath:${normalizedExternal.bundlePath}`;
          const hash = `${urlKey}-${libraryNameStr}`;
          if (hasUrlLibraryNamePairInjected.has(hash)) {
            continue;
          }
          hasUrlLibraryNamePairInjected.add(hash);

          const fetchExpr = normalizedExternal.url
            ? JSON.stringify(normalizedExternal.url)
            : `${compiler.webpack.RuntimeGlobals.publicPath} + ${
              JSON.stringify(normalizedExternal.bundlePath)
            }`;
          url2fetchCode.set(
            urlKey,
            `lynx.fetchBundle(${fetchExpr}, {});`,
          );

          const mountVar = `${
            getLynxExternalGlobal(
              externalsLoadingPluginOptions.globalObject,
            )
          }[${JSON.stringify(libraryNameStr)}]`;
          if (async) {
            loadCode.add(
              `${mountVar} = ${mountVar} === undefined ? createLoadExternalAsync(handler${
                [...url2fetchCode.keys()].indexOf(urlKey)
              }, ${JSON.stringify(layerOptions.sectionPath)}) : ${mountVar};`,
            );
            continue;
          }

          loadCode.add(
            `${mountVar} = ${mountVar} === undefined ? createLoadExternalSync(handler${
              [...url2fetchCode.keys()].indexOf(urlKey)
            }, ${
              JSON.stringify(layerOptions.sectionPath)
            }, ${timeout}) : ${mountVar};`,
          );
        }

        return [
          runtimeGlobalsInit,
          loadExternalFunc,
          ...[...url2fetchCode.values()].map((fetchCode, index) =>
            `const handler${index} = ${fetchCode};`
          ),
          ...loadCode,
        ].join('\n');
      }
    }

    compiler.hooks.environment.tap(ExternalsLoadingPlugin.name, () => {
      compiler.options.externals = [
        ...(Array.isArray(compiler.options.externals)
          ? compiler.options.externals
          : (typeof compiler.options.externals === 'undefined'
            ? []
            : [compiler.options.externals])),
        this.#genExternalsConfig(externalsLoadingPluginOptions.globalObject),
      ];
    });

    compiler.hooks.compilation.tap(
      ExternalsLoadingRuntimeModule.name,
      compilation => {
        compilation.hooks.additionalTreeRuntimeRequirements
          .tap(
            ExternalsLoadingRuntimeModule.name,
            (chunk, runtimeRequirements) => {
              const modules = compilation.chunkGraph.getChunkModulesIterable(
                chunk,
              );
              let layer: string | undefined;
              for (const module of modules) {
                if (module.layer) {
                  layer = module.layer;
                  break;
                }
              }
              if (!layer) {
                // Skip chunks without a layer
                return;
              }
              runtimeRequirements.add(
                compiler.webpack.RuntimeGlobals.publicPath,
              );
              compilation.addRuntimeModule(
                chunk,
                new ExternalsLoadingRuntimeModule(runtimeRequirements, {
                  layer,
                }),
              );
            },
          );
      },
    );
  }

  /**
   * If the external is async, use `promise` external type; otherwise, use `var` external type.
   */
  #genExternalsConfig(
    globalObject: ExternalsLoadingPluginOptions['globalObject'],
  ): (
    data: ExternalItemFunctionData,
    callback: (
      err?: Error,
      result?: ExternalItemValue,
      type?: ExternalsType,
    ) => void,
  ) => void {
    const { externals, backgroundLayer, mainThreadLayer } = this.options;
    const externalDeps = new Set(Object.keys(externals));

    return ({ request, contextInfo }, callback) => {
      const currentLayer = contextInfo?.issuerLayer === mainThreadLayer
        ? 'mainThread'
        : (contextInfo?.issuerLayer === backgroundLayer
          ? 'background'
          : undefined);
      if (
        request
        && externalDeps.has(request)
        && currentLayer
        && externals[request]?.[currentLayer]
      ) {
        const isAsync = externals[request]?.async ?? true;
        const libraryName = externals[request]?.libraryName ?? request;
        return callback(
          undefined,
          [
            getLynxExternalGlobal(globalObject),
            ...(Array.isArray(libraryName) ? libraryName : [libraryName]),
          ],
          isAsync ? 'promise' : undefined,
        );
      }
      // Continue without externalizing the import
      callback();
    };
  }
}
