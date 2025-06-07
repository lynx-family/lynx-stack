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
          // Wait CSS Extract Plugin to finish its `hooks.encode.tap`
          setTimeout(() => {
            // @ts-expect-error
            const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(
              compilation,
            );
            hooks.encode.promise({
              templateType: 'main',
              encodeOptions: {
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
              intermediate: '.rspeedy/main',
            });
          });
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
