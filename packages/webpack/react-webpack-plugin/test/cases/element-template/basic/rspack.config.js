import { expect } from 'vitest';

import {
  LynxEncodePlugin,
  LynxTemplatePlugin,
} from '@lynx-js/template-webpack-plugin';

import { createConfig } from '../../../create-react-config.js';

const defaultConfig = createConfig(
  {
    experimental_enableElementTemplate: true,
  },
  {
    experimental_enableElementTemplate: true,
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
                  "_et_a99d6_54654_1": {
                    "children": [
                      {
                        "attributes": {
                          "text": "Hello, ",
                        },
                        "tag": "text",
                      },
                      {
                        "attributes": {
                          "part-id": 0,
                        },
                        "tag": "slot",
                      },
                    ],
                    "tag": "view",
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
