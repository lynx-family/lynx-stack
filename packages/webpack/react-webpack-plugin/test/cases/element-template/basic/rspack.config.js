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
            const userTemplateIds = Object.keys(args.encodeData.elementTemplate)
              .filter(id => id !== '_et_builtin_raw_text');
            expect(userTemplateIds).toHaveLength(1);
            expect(userTemplateIds[0]).toMatch(/^_et_[a-f0-9]{12}$/);
            expect(Object.keys(args.encodeData.elementTemplate).sort())
              .toEqual(['_et_builtin_raw_text', userTemplateIds[0]].sort());
            expect(args.encodeData.elementTemplate[userTemplateIds[0]])
              .toMatchInlineSnapshot(`
                {
                  "attributesArray": [],
                  "children": [
                    {
                      "attributesArray": [
                        {
                          "key": "text",
                          "kind": "static",
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
                }
              `);
            expect(args.encodeData.elementTemplate._et_builtin_raw_text)
              .toMatchInlineSnapshot(`
                {
                  "attributesArray": [
                    {
                      "attrSlotIndex": 0,
                      "key": "text",
                      "kind": "slot",
                    },
                  ],
                  "children": [],
                  "kind": "element",
                  "type": "raw-text",
                }
              `);
            return args;
          });
        },
      );
    },
  ],
};
