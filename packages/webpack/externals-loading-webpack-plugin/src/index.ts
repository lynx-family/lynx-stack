// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @packageDocumentation
 *
 * A webpack plugin to load externals in Lynx. Use `lynx.fetchBundle()` and `lynx.loadScript()` API to load and parse the externals.
 *
 * @remark
 * It requires Lynx >= 3.4.
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
   * The chunk names to be considered as main thread chunks.
   */
  mainThreadChunks: string[];

  /**
   * The chunk names to be considered as background chunks.
   */
  backgroundChunks: string[];

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
   *          libraryName: "Lodash",
   *          url: 'http://lodash.template.js',
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
   *          libraryName: "Lodash",
   *          url: 'http://lodash.template.js',
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
    {
      /**
       * The name of the library.
       *
       * @example `Lodash`
       */
      libraryName: string;
      /**
       * The bundle(template.js) url of the library. The source should be placed in `customSections`.
       */
      url: string;
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
       * @defaultValue `100`
       */
      timeout?: number;
    }
  >;
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

/**
 * External loading webpack plugin.
 *
 * @public
 */
export class ExternalsLoadingPlugin {
  static RuntimeGlobals = {
    lynxExternals: '__webpack_require__.lynx_ex',
  };

  constructor(private options: ExternalsLoadingPluginOptions) {}

  apply(compiler: Compiler): void {
    const { RuntimeModule } = compiler.webpack;

    const externalsLoadingPluginOptions = this.options;

    class ExternalsLoadingRuntimeModule extends RuntimeModule {
      constructor() {
        super('externals-loading-runtime');
      }

      override generate() {
        if (!this.chunk?.name) {
          return '';
        }
        if (!externalsLoadingPluginOptions.externals) {
          return '';
        }

        if (
          externalsLoadingPluginOptions.backgroundChunks.some(name =>
            name === this.chunk!.name
          )
        ) {
          return this.#genFetchAndLoadCode('background');
        }

        if (
          externalsLoadingPluginOptions.mainThreadChunks.some(name =>
            name === this.chunk!.name
          )
        ) {
          return this.#genFetchAndLoadCode('mainThread');
        }

        return '';
      }

      #genFetchAndLoadCode(
        layer: 'background' | 'mainThread',
      ): string {
        const fetchCode: string[] = [];
        const asyncLoadCode: string[] = [];
        const syncLoadCode: string[] = [];
        // filter duplicate externals by libraryName to avoid loading the same external multiple times. We keep the last one.
        const externalsMap = new Map<
          string,
          ExternalsLoadingPluginOptions['externals'][string]
        >();
        for (
          const external of Object.values(
            externalsLoadingPluginOptions.externals,
          )
        ) {
          externalsMap.set(external.libraryName, external);
        }
        const externals = Array.from(externalsMap.values());

        if (externals.length === 0) {
          return '';
        }
        const runtimeGlobalsInit =
          `${ExternalsLoadingPlugin.RuntimeGlobals.lynxExternals} = {};`;
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
`;

        for (let i = 0; i < externals.length; i++) {
          const external = externals[i]!;
          const { libraryName, url, async = true, timeout: timeoutInMs = 100 } =
            external;
          const layerOptions = external[layer];
          // Lynx fetchBundle timeout is in seconds
          const timeout = timeoutInMs / 1000;

          if (!layerOptions?.sectionPath) {
            continue;
          }
          fetchCode.push(
            `const handler${i} = lynx.fetchBundle(${JSON.stringify(url)}, {});`,
          );
          if (async) {
            asyncLoadCode.push(
              `${ExternalsLoadingPlugin.RuntimeGlobals.lynxExternals}[${
                JSON.stringify(libraryName)
              }] = createLoadExternalAsync(handler${i}, ${
                JSON.stringify(layerOptions.sectionPath)
              });`,
            );
            continue;
          }

          syncLoadCode.push(
            `${ExternalsLoadingPlugin.RuntimeGlobals.lynxExternals}[${
              JSON.stringify(libraryName)
            }] = createLoadExternalSync(handler${i}, ${
              JSON.stringify(layerOptions.sectionPath)
            }, ${timeout});`,
          );
        }

        return [
          runtimeGlobalsInit,
          loadExternalFunc,
          fetchCode,
          asyncLoadCode,
          syncLoadCode,
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
        this.#genExternalsConfig(),
      ];
    });

    compiler.hooks.compilation.tap(
      ExternalsLoadingRuntimeModule.name,
      compilation => {
        compilation.hooks.additionalTreeRuntimeRequirements
          .tap(ExternalsLoadingRuntimeModule.name, (chunk) => {
            compilation.addRuntimeModule(
              chunk,
              new ExternalsLoadingRuntimeModule(),
            );
          });
      },
    );
  }

  /**
   * If the external is async, use `promise` external type; otherwise, use `var` external type.
   */
  #genExternalsConfig(): (
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
        return callback(
          undefined,
          `${
            isAsync ? 'promise ' : ''
          }${ExternalsLoadingPlugin.RuntimeGlobals.lynxExternals}[${
            JSON.stringify(externals[request]?.libraryName)
          }]`,
        );
      }
      // Continue without externalizing the import
      callback();
    };
  }
}
