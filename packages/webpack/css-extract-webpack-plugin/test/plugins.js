// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin';

/**
 * @param {Object} encodeOptions
 *
 * @returns {import('@rspack/core').RspackPluginInstance}
 */
export const mockLynxTemplatePlugin = (encodeOptions = {}) => {
  return {
    name: 'MockLynxTemplatePlugin',
    apply(compiler) {
      compiler.hooks.thisCompilation.tap(
        'MockLynxTemplatePlugin',
        (compilation) => {
          const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(
            // @ts-expect-error
            compilation,
          );
          hooks.encode.tapPromise(
            'MockLynxTemplatePlugin',
            (args) => {
              const buffer = Buffer.from(JSON.stringify(args.encodeOptions));
              return Promise.resolve({
                buffer,
                debugInfo: '',
              });
            },
          );
          compilation.hooks.processAssets.tap(
            {
              name: 'MockLynxTemplatePlugin',
              stage: compiler.webpack.Compilation
                .PROCESS_ASSETS_STAGE_OPTIMIZE_HASH,
            },
            (assets) => {
              hooks.beforeEmit.promise({
                finalEncodeOptions: {
                  'compilerOptions': {
                    'enableRemoveCSSScope': false,
                  },
                  'sourceContent': {
                    'dsl': 'react_nodiff',
                    'appType': 'card',
                    'config': {
                      'lepusStrict': true,
                    },
                  },
                  'manifest': {},
                  'lepusCode': {
                    'root': undefined,
                    'lepusChunk': {},
                  },
                  'customSections': {},
                  ...encodeOptions,
                },
                // @ts-expect-error `info` field is not needed by css extract plugin.
                'cssChunks': Object.entries(assets).filter(([filename]) =>
                  filename.endsWith('.css')
                ).map(([filename, source]) => ({
                  'name': filename,
                  'source': source,
                })),
              });
            },
          );
        },
      );
    },
  };
};

/**
 * @type {import('@rspack/core').RspackPluginInstance[]}
 */
export const plugins = [
  mockLynxTemplatePlugin(),
];
