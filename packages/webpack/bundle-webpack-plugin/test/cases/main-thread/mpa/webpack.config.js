import { LynxTemplatePlugin, LynxEncodePlugin } from '../../../../src';

/** @type {import('@rspack/core').Configuration} */
export default {
  entry: {
    a: './a.js',
    b: './b.js',
    c: './c.js',
    d: './d.js',
    e: './e.js',
    'a:main-thread': { import: './a.js', filename: 'a/a.lepus.js' },
    'b:main-thread': { import: './b.js', filename: 'b/b.lepus.js' },
    'c:main-thread': { import: './c.js', filename: 'c/c.lepus.js' },
    'd:main-thread': { import: './d.js', filename: 'd/d.lepus.js' },
    'e:main-thread': { import: './e.js', filename: 'e/e.lepus.js' },
  },
  context: __dirname,
  output: {
    filename: '[name]/[name].js',
  },
  plugins: [
    new LynxEncodePlugin(),
    new LynxTemplatePlugin({
      ...LynxTemplatePlugin.defaultOptions,
      chunks: ['a', 'a:main-thread'],
      filename: 'a/template.js',
      intermediate: '.rspeedy/a',
      excludeChunks: ['b', 'c', 'd', 'e'],
    }),

    new LynxTemplatePlugin({
      ...LynxTemplatePlugin.defaultOptions,
      chunks: ['b', 'b:main-thread'],
      filename: 'b/template.js',
      intermediate: '.rspeedy/b',
      excludeChunks: ['a', 'c', 'd', 'e'],
    }),

    new LynxTemplatePlugin({
      ...LynxTemplatePlugin.defaultOptions,
      chunks: ['c', 'c:main-thread'],
      filename: 'c/template.js',
      intermediate: '.rspeedy/c',
      excludeChunks: ['b', 'a', 'd', 'e'],
    }),

    new LynxTemplatePlugin({
      ...LynxTemplatePlugin.defaultOptions,
      chunks: ['d', 'd:main-thread'],
      filename: 'd/template.js',
      intermediate: '.rspeedy/d',
      excludeChunks: ['b', 'c', 'a', 'e'],
    }),

    new LynxTemplatePlugin({
      ...LynxTemplatePlugin.defaultOptions,
      chunks: ['e', 'e:main-thread'],
      filename: 'e/template.js',
      intermediate: '.rspeedy/e',
      excludeChunks: ['b', 'c', 'd', 'a'],
    }),

    compiler => {
      compiler.hooks.thisCompilation.tap('test', (compilation) => {
        compilation.hooks.processAssets.tap('test', () => {
          ['a', 'b', 'c', 'd', 'e'].forEach(name => {
            const asset = compilation.getAsset(`${name}/${name}.lepus.js`);
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
