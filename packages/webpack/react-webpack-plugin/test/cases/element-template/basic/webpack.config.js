import { createRequire } from 'node:module';

import { expect } from 'vitest';

import {
  LynxEncodePlugin,
  LynxTemplatePlugin,
} from '@lynx-js/template-webpack-plugin';

import { LAYERS, ReactWebpackPlugin } from '../../../../src';

const require = createRequire(import.meta.url);

/** @type {import('webpack').Configuration} */
export default {
  context: __dirname,
  entry: {
    'main__main-thread': {
      layer: LAYERS.MAIN_THREAD,
      import: './index.jsx',
    },
    'main__background': {
      layer: LAYERS.BACKGROUND,
      import: './index.jsx',
    },
  },
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        loader: 'swc-loader',
        options: {
          jsc: {
            parser: {
              syntax: 'typescript',
              decorators: true,
            },
          },
        },
      },
      {
        test: /\.[jt]sx?$/,
        issuerLayer: LAYERS.BACKGROUND,
        use: [
          {
            loader: ReactWebpackPlugin.loaders.BACKGROUND,
            options: {
              experimental_enableElementTemplate: true,
            },
          },
        ],
      },
      {
        test: /\.[jt]sx?$/,
        issuerLayer: LAYERS.MAIN_THREAD,
        use: [
          {
            loader: ReactWebpackPlugin.loaders.MAIN_THREAD,
            options: {
              experimental_enableElementTemplate: true,
            },
          },
        ],
      },
    ],
  },
  resolve: {
    extensionAlias: {
      '.js': ['.js', '.ts', '.jsx'],
    },
  },
  output: {
    filename: '[name].js',
  },
  plugins: [
    new ReactWebpackPlugin({
      mainThreadChunks: ['main__main-thread.js'],
      workletRuntimePath: require.resolve('@lynx-js/react/worklet-dev-runtime'),
      experimental_enableElementTemplate: true,
    }),
    new LynxTemplatePlugin(),
    new LynxEncodePlugin(),
    /**
     * @param {import('webpack').Compiler} compiler
     */
    (compiler) => {
      compiler.hooks.thisCompilation.tap(
        'element-template-test',
        (compilation) => {
          const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(
            compilation,
          );
          hooks.beforeEncode.tap('element-template-test', (args) => {
            if (!args.encodeData.elementTemplate) {
              throw new Error('elementTemplate should exist');
            }
            expect(args.encodeData.elementTemplate)
              .toMatchInlineSnapshot(`
                {
                  "__et_builtin_raw_text__": {
                    "attributesArray": [
                      {
                        "attrSlotIndex": 0,
                        "binding": "slot",
                        "key": "text",
                        "kind": "attribute",
                      },
                    ],
                    "children": [],
                    "kind": "element",
                    "type": "raw-text",
                  },
                  "_et_a99d6_54654_1": {
                    "attributesArray": [],
                    "children": [
                      {
                        "attributesArray": [
                          {
                            "binding": "static",
                            "key": "text",
                            "kind": "attribute",
                            "value": "Hello, ",
                          },
                        ],
                        "children": [],
                        "kind": "element",
                        "type": "raw-text",
                      },
                      {
                        "elementSlotIndex": 0,
                        "kind": "elementSlot",
                        "type": "slot",
                      },
                    ],
                    "kind": "element",
                    "type": "view",
                  },
                }
              `);
            return args;
          });
        },
      );
    },
  ],
};
