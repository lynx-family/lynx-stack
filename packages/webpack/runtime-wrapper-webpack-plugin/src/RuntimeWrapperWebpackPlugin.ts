// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { BannerPlugin, Compiler } from 'webpack';

import { RuntimeGlobals } from '@lynx-js/webpack-runtime-globals';

/**
 * The options for RuntimeWrapperWebpackPluginOptions
 *
 * @public
 */
interface RuntimeWrapperWebpackPluginOptions {
  /**
   * {@inheritdoc @lynx-js/template-webpack-plugin#LynxTemplatePluginOptions.targetSdkVersion}
   */
  targetSdkVersion: string;
  /**
   * Include all modules that pass test assertion.
   *
   * @defaultValue `/\.js$/`
   *
   * @public
   */
  test: BannerPlugin['options']['test'];
  /**
   * There are two types of banners: script(for app-service) and bundle(for js-render). You can decide to use which banner by the filename.
   *
   * @defaultValue `() => 'script'`
   *
   * @public
   */
  bannerType: (filename: string) => 'script' | 'bundle';

  /**
   * The variables to be injected into the chunk.
   */
  injectVars?: ((vars: string[]) => string[]) | string[];
}

const defaultInjectVars = [
  'Card',
  'setTimeout',
  'setInterval',
  'clearInterval',
  'clearTimeout',
  'NativeModules',
  'tt',
  'console',
  'Component',
  'ReactLynx',
  'nativeAppId',
  'Behavior',
  'LynxJSBI',
  'lynx',
  'window',
];

/**
 * RuntimeWrapperWebpackPlugin adds runtime wrappers to JavaScript and allow to be loaded by Lynx.
 *
 * @public
 */
class RuntimeWrapperWebpackPlugin {
  constructor(
    private readonly options: Partial<RuntimeWrapperWebpackPluginOptions> = {},
  ) {}

  /**
   * `defaultOptions` is the default options that the {@link RuntimeWrapperWebpackPlugin} uses.
   *
   * @public
   */
  static defaultOptions: Readonly<
    Required<RuntimeWrapperWebpackPluginOptions>
  > = Object.freeze<Required<RuntimeWrapperWebpackPluginOptions>>({
    targetSdkVersion: '3.2',
    test: /\.js$/,
    bannerType: () => 'script',
    injectVars: defaultInjectVars,
  });

  /**
   * The entry point of a webpack plugin.
   * @param compiler - the webpack compiler
   */
  apply(compiler: Compiler): void {
    new RuntimeWrapperWebpackPluginImpl(
      compiler,
      Object.assign(
        {},
        RuntimeWrapperWebpackPlugin.defaultOptions,
        this.options,
      ),
    );
  }
}

export { RuntimeWrapperWebpackPlugin };
export type { RuntimeWrapperWebpackPluginOptions };

const defaultInjectStr = defaultInjectVars.join(',');

class RuntimeWrapperWebpackPluginImpl {
  name = 'RuntimeWrapperWebpackPlugin';

  constructor(
    public compiler: Compiler,
    public options: RuntimeWrapperWebpackPluginOptions,
  ) {
    const { targetSdkVersion, test } = options;
    const { BannerPlugin } = compiler.webpack;

    const isDev = process.env['NODE_ENV'] === 'development'
      || compiler.options.mode === 'development';

    let injectStr = defaultInjectStr;

    if (typeof options.injectVars === 'function') {
      injectStr = options.injectVars(defaultInjectVars).join(',');
    }

    // banner
    new BannerPlugin({
      test: test!,
      raw: true,
      banner: ({ chunk, filename }) => {
        const banner = this.#getBannerType(filename) === 'script'
          ? loadScriptBanner()
          : loadBundleBanner();

        return banner
          + amdBanner({
            // TODO: config
            injectStr,
            overrideRuntimePromise: true,
            moduleId: '[name].js',
            targetSdkVersion,
          })
          + (isDev
            ? lynxChunkEntries(JSON.stringify(chunk.id))
            : '');
      },
    }).apply(compiler);

    // footer
    new BannerPlugin({
      test: test!,
      footer: true,
      raw: true,
      banner: ({ filename }) => {
        const footer = this.#getBannerType(filename) === 'script'
          ? loadScriptFooter
          : loadBundleFooter;
        return amdFooter('[name].js') + footer;
      },
    }).apply(compiler);
  }

  #getBannerType(filename: string) {
    const bannerType = this.options.bannerType(filename);
    if (bannerType !== 'bundle' && bannerType !== 'script') {
      throw new Error(
        `The return value of the bannerType expects the 'bundle' or 'script', but received '${bannerType as string}'.`,
      );
    }
    return bannerType;
  }
}

function lynxChunkEntries(chunkId: string) {
  return `// lynx chunks entries
if (!${RuntimeGlobals.lynxChunkEntries}) {
  // Initialize once
  ${RuntimeGlobals.lynxChunkEntries} = {};
}
if (!${RuntimeGlobals.lynxChunkEntries}[${chunkId}]) {
  ${RuntimeGlobals.lynxChunkEntries}[${chunkId}] = globDynamicComponentEntry;
} else {
  globDynamicComponentEntry = ${RuntimeGlobals.lynxChunkEntries}[${chunkId}];
}
`;
}

// This is Lynx js runtime code. It will wrap user code (e. app-service.js, chunk.js)
// with two function wrapper, the outer function provide some utility functions, such as
// * `define` objects that the frontend framework implementor can use to provide some global-looking variables
//   that are actually specific to the module in the inner function wrapper, such as
//   * The `module` and `exports` are reserved objects that used to export values from the module in cjs, Lynx
//     use `requireModule`/`requireModuleAsync` & return object to do `require` / `export` staffs rather than them.
//   * common JS API `setTimeout`, `setInterval`, `clearInterval`, `clearTimeout`, `NativeModules`, `console`,
//   * `nativeAppId`, `lynx`, `LynxJSBI`
// Besides these, runtime code also contains some injected code to provide certain features.
// For example, the Promise object is replaced with a call to "getPromise" when `overrideRuntimePromise` is true.

const loadScriptBanner = (strictMode = true) =>
  `(function(){
  ${strictMode ? '\'use strict\';' : ';'}
  var g = (new Function('return this;'))();
  function __init_card_bundle__(lynxCoreInject) {
    g.__bundle__holder = undefined;
    var globDynamicComponentEntry = g.globDynamicComponentEntry || '__Card__';
    var tt = lynxCoreInject.tt;`;

const loadBundleBanner = (strictMode = true) =>
  `(function(){
  ${strictMode ? '\'use strict\';' : ';'}
  var eval2 = eval;
  var g = eval2("this");
  function initBundle(lynxCoreInject) {
    var tt = lynxCoreInject.tt;
`;

const amdBanner = ({
  injectStr,
  moduleId,
  overrideRuntimePromise,
  targetSdkVersion,
}: {
  injectStr: string;
  moduleId: string;
  overrideRuntimePromise: boolean;
  targetSdkVersion: string;
}) => {
  return (
    `
    tt.define("${moduleId}", function(require, module, exports, ${injectStr}) {
lynx = lynx || {};
lynx.targetSdkVersion=lynx.targetSdkVersion||${
      JSON.stringify(targetSdkVersion)
    };
${overrideRuntimePromise ? `var Promise = lynx.Promise;` : ''}
var fetch = lynx.fetch;
`
  );
};

const amdFooter = (moduleId: string) => `
    });
    return tt.require("${moduleId}");`;

// footer for app-service.js chunk
const loadScriptFooter = `
  };`
  // FYI: bundleModuleMode

  // The loadScript behavior of app-service.js is determined by bundleModuleMode

  // bundleModuleMode: 'EvalRequire' (default, unable to get the correct error stack.)

  // ------------
  // lynx_core.js

  // const jsContent = nativeApp.readScript('app-service.js');
  // eval(jsContent);
  // -------------

  // bundleModuleMode: 'ReturnByFunction' (most used since 2 yrs ago, 2020-11)

  // ------------
  // lynx_core.js
  // const bundleInitReturnObj: BundleInitReturnObj = nativeApp.loadScript(appServiceName);
  // if (bundleInitReturnObj && bundleInitReturnObj.init) {
  //   bundleInitReturnObj.init({ tt });
  // }
  // -------------
  + `
  if (g && g.bundleSupportLoadScript){
    var res = {init: __init_card_bundle__};
    g.__bundle__holder = res;
    return res;
  } else {
    __init_card_bundle__({"tt": tt});
  };
})();
`;

const loadBundleFooter = `}
  g.initBundle = initBundle;
  })()`;
