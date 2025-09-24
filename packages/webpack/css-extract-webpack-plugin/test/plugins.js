// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin';

/**
 * Use `JSON.stringify` to mock the encode of `@lynx-js/tasm` to help better testing.
 *
 * @returns {import('webpack').WebpackPluginInstance}
 */
export const mockLynxEncodePlugin = () => {
  return {
    name: 'MockLynxEncodePlugin',
    apply(compiler) {
      compiler.options.entry;
      compiler.hooks.thisCompilation.tap(
        'MockLynxEncodePlugin',
        (compilation) => {
          const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(
            compilation,
          );
          hooks.encode.tapPromise(
            'MockLynxEncodePlugin',
            (args) => {
              const buffer = Buffer.from(JSON.stringify(args.encodeOptions));
              return Promise.resolve({
                buffer,
                debugInfo: '',
              });
            },
          );
        },
      );
    },
  };
};

/**
 * @param {{
 *  lynxTemplatePluginOptions?: Partial<LynxTemplatePlugin['options']>
 * }} options
 * @returns {import('webpack').WebpackPluginInstance[]}
 */
export function getPlugins({
  lynxTemplatePluginOptions,
}) {
  return [
    mockLynxEncodePlugin(),
    new LynxTemplatePlugin({
      ...LynxTemplatePlugin.defaultOptions,
      ...lynxTemplatePluginOptions,
    }),
  ];
}

/**
 * @type {import('webpack').WebpackPluginInstance[]}
 */
export const plugins = [
  mockLynxEncodePlugin(),
  new LynxTemplatePlugin(),
];
