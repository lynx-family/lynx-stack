import { expect } from 'vitest';

import {
  LynxEncodePlugin,
  LynxTemplatePlugin,
} from '@lynx-js/template-webpack-plugin';

import { createConfig } from '../../../create-react-config.js';

const defaultConfig = createConfig(
  {
    experimental_useElementTemplate: true,
  },
  {
    experimental_useElementTemplate: true,
  },
);

/** @type {import('@rspack/core').Configuration} */
export default {
  context: __dirname,
  ...defaultConfig,
  plugins: [
    ...(defaultConfig.plugins ?? []),
    new LynxTemplatePlugin(),
    new LynxEncodePlugin(),
    /**
     * @param {import('@rspack/core').Compiler} compiler
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
                  "_et_a99d6_8660e_1": {
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
