import { LynxTemplatePlugin, WebEncodePlugin } from '../../../../src';

/** @type {import('@rspack/core').Configuration} */
export default {
  entry: {
    a: './a.js',
    b: './b.js',
    'a:main-thread': { import: './a.js', filename: 'a/a.lepus.js' },
    'b:main-thread': { import: './b.js', filename: 'b/b.lepus.js' },
  },
  context: __dirname,
  output: {
    filename: '[name]/[name].js',
  },
  plugins: [
    new WebEncodePlugin({
      include: [/a.js/g],
      cardType: 'react',
      allInOne: true,
    }),
    new LynxTemplatePlugin({
      ...LynxTemplatePlugin.defaultOptions,
      chunks: ['a', 'a:main-thread'],
      filename: 'a/template.js',
      intermediate: '.rspeedy/a',
    }),

    compiler => {
      compiler.hooks.thisCompilation.tap('test', (compilation) => {
        compilation.hooks.processAssets.tap('test', () => {
          ['a'].forEach(name => {
            const asset = compilation.getAsset(`${name}/${name}.js`);
            compilation.updateAsset(asset.name, asset.source, {
              ...asset.info,
              'lynx:main-thread': true,
            });
          });
        });
      });
    },
  ],
};
