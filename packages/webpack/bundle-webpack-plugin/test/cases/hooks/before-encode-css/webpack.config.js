import { LynxEncodePlugin, LynxTemplatePlugin } from '../../../../src';

/** @type {import('webpack').Configuration} */
export default {
  target: 'node',
  plugins: [
    new LynxEncodePlugin(),
    new LynxTemplatePlugin(),
    (compiler) => {
      compiler.hooks.thisCompilation.tap('test', compilation => {
        const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(
          compilation,
        );

        hooks.beforeEncode.tap(
          'test-before-encode',
          (args) => {
            // Modify the CSS in the hook to simulate what a plugin might do
            return {
              ...args,
              encodeData: {
                ...args.encodeData,
                css: {
                  cssMap: {
                    '1': [
                      {
                        'type': 'StyleRule',
                        'style': [
                          {
                            'name': 'display',
                            'value': 'flex',
                            'keyLoc': {
                              'line': 1,
                              'column': 14,
                            },
                            'valLoc': {
                              'line': 1,
                              'column': 20,
                            },
                          },
                        ],
                        'selectorText': {
                          'value': '.item',
                          'loc': {
                            'line': 1,
                            'column': 6,
                          },
                        },
                        'variables': {},
                      },
                    ],
                  },
                  cssSource: {
                    1: '/cssId/1.css',
                  },
                },
              },
            };
          },
        );
      });
    },
  ],
};
