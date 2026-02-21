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
   * The bundle url of the library. The library source should be placed in `customSections`.
   */
  url: string;

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
  constructor(private options: ExternalsLoadingPluginOptions) {}

  apply(compiler: Compiler): void {
    const { RuntimeModule } = compiler.webpack;

    const externalsLoadingPluginOptions = this.options;

    class ExternalsLoadingRuntimeModule extends RuntimeModule {
      constructor(private options: { layer: string }) {
        super('externals-loading-runtime');
      }

      override generate() {
        if (!this.chunk?.name || !externalsLoadingPluginOptions.externals) {
          return '';
        }
        return this.#genExternalsLoadingCode(this.options.layer);
      }

      #genExternalsLoadingCode(
        chunkLayer: string,
      ): string {
        const loadCode: string[] = [];
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

        for (
          const [pkgName, external] of Object.entries(
            externalsLoadingPluginOptions.externals,
          )
        ) {
          externalsMap.set(external.libraryName ?? pkgName, external);
        }
        const externals = Array.from(externalsMap.entries());

        if (externals.length === 0) {
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
          resolve(result)
        } catch (error) {
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
      return result
    } catch (error) {
      throw new Error('Failed to load script ' + sectionPath + ' in ' + response.url, { cause: error })
    }
  } else {
    throw new Error('Failed to fetch external source ' + response.url + ' . The response is ' + JSON.stringify(response), { cause: response })
  }
}

function createLazyExternal(loader) {
  let realModule = null;
  let loading = false;

  function load() {
    if (realModule) return realModule;

    if (!loading) {
      loading = true;
      realModule = loader();
    }

    return realModule;
  }

  return new Proxy(function () {}, {
    get(_, key) {
      if (key === '__esModule') return true;
      const mod = load();
      return mod[key];
    },
    apply(_, thisArg, args) {
      const mod = load();
      return mod.apply(thisArg, args);
    },
  });
}
`;

        const symbolDeclarations: string[] = [];
        const hasUrlLibraryNamePairInjected = new Set();
        let loaderIndex = 0;

        for (const [pkgName, external] of externals) {
          const {
            libraryName,
            url,
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

          const hash = `${url}-${libraryNameStr}`;
          if (hasUrlLibraryNamePairInjected.has(hash)) {
            continue;
          }
          hasUrlLibraryNamePairInjected.add(hash);

          const symbolVarName = `_symbolForExternal_${loaderIndex}`;
          symbolDeclarations.push(
            `const ${symbolVarName} = Symbol.for(${
              JSON.stringify(libraryNameStr)
            });`,
          );

          const externalGlobalAccessor = `${
            getLynxExternalGlobal(externalsLoadingPluginOptions.globalObject)
          }`;

          if (async) {
            loadCode.push(
              `Object.defineProperty(${externalGlobalAccessor}, ${
                JSON.stringify(libraryNameStr)
              }, {
  get() {
    if (!this[${symbolVarName}]) {
      this[${symbolVarName}] = createLoadExternalAsync(lynx.fetchBundle(${
                JSON.stringify(url)
              }, {}), ${JSON.stringify(layerOptions.sectionPath)});
    }
    return this[${symbolVarName}];
  },
  configurable: true
});`,
            );
          } else {
            loadCode.push(
              `Object.defineProperty(${externalGlobalAccessor}, ${
                JSON.stringify(libraryNameStr)
              }, {
  get() {
    if (!this[${symbolVarName}]) {
      this[${symbolVarName}] = createLazyExternal(() => createLoadExternalSync(lynx.fetchBundle(${
                JSON.stringify(url)
              }, {}), ${JSON.stringify(layerOptions.sectionPath)}, ${timeout}));
    }
    return this[${symbolVarName}];
  },
  configurable: true
});`,
            );
          }
          loaderIndex++;
        }

        return [
          runtimeGlobalsInit,
          loadExternalFunc,
          symbolDeclarations,
          loadCode,
        ].flat().join('\n');
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
        const layers: { name: 'mainThread' | 'background'; layer: string }[] = [
          {
            name: 'mainThread',
            layer: externalsLoadingPluginOptions.mainThreadLayer,
          },
          {
            name: 'background',
            layer: externalsLoadingPluginOptions.backgroundLayer,
          },
        ];

        for (const layerInfo of layers) {
          const libraryConfigs = new Map<
            string,
            { sectionPath: string; definedBy: string }
          >();

          for (
            const [pkgName, external] of Object.entries(
              externalsLoadingPluginOptions.externals,
            )
          ) {
            const { libraryName, url } = external;
            const layerOptions = external[layerInfo.name];

            if (!layerOptions?.sectionPath) {
              continue; // No config for this layer, nothing to validate.
            }

            const libraryNameWithDefault = libraryName ?? pkgName;
            const libraryNameStr = Array.isArray(libraryNameWithDefault)
              ? libraryNameWithDefault[0]
              : libraryNameWithDefault;
            const hash = `${url}-${libraryNameStr}`;

            if (libraryConfigs.has(hash)) {
              const existingConfig = libraryConfigs.get(hash)!;
              if (existingConfig.sectionPath !== layerOptions.sectionPath) {
                compilation.errors.push(
                  new Error(
                    `ExternalsLoadingPlugin Error: Conflicting 'sectionPath' configurations found for library "${libraryNameStr}" (from URL "${url}") in the "${layerInfo.name}" layer.\n`
                      + `- Defined in "${existingConfig.definedBy}": "${existingConfig.sectionPath}"\n`
                      + `- Defined in "${pkgName}": "${layerOptions.sectionPath}"\n`
                      + `Please ensure all externals pointing to the same library bundle have a consistent 'sectionPath' for each layer.`,
                  ),
                );
              }
            } else {
              libraryConfigs.set(hash, {
                sectionPath: layerOptions.sectionPath,
                definedBy: pkgName,
              });
            }
          }
        }

        compilation.hooks.additionalTreeRuntimeRequirements
          .tap(ExternalsLoadingRuntimeModule.name, (chunk) => {
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
            compilation.addRuntimeModule(
              chunk,
              new ExternalsLoadingRuntimeModule({ layer }),
            );
          });
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
