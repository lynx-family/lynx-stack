import { LynxEncodePlugin, LynxTemplatePlugin } from '../../../../src';

/** @type {import('@rspack/core').Configuration} */
export default {
  entry: {
    a: './a.js',
    b: './b.js',
    c: './c.js',
    d: './d.js',
    e: './e.js',
  },
  context: __dirname,
  output: {
    filename: '[name]/[name].js',
  },
  plugins: [
    new LynxEncodePlugin(),
    new LynxTemplatePlugin({
      ...LynxTemplatePlugin.defaultOptions,
      chunks: ['a'],
      filename: 'a/template.js',
      intermediate: '.rspeedy/a',
      excludeChunks: ['b', 'c', 'd', 'e'],
    }),

    new LynxTemplatePlugin({
      ...LynxTemplatePlugin.defaultOptions,
      chunks: ['b'],
      filename: 'b/template.js',
      intermediate: '.rspeedy/b',
      excludeChunks: ['a', 'c', 'd', 'e'],
    }),

    new LynxTemplatePlugin({
      ...LynxTemplatePlugin.defaultOptions,
      chunks: ['c'],
      filename: 'c/template.js',
      intermediate: '.rspeedy/c',
      excludeChunks: ['b', 'a', 'd', 'e'],
    }),

    new LynxTemplatePlugin({
      ...LynxTemplatePlugin.defaultOptions,
      chunks: ['d'],
      filename: 'd/template.js',
      intermediate: '.rspeedy/d',
      excludeChunks: ['b', 'c', 'a', 'e'],
    }),

    new LynxTemplatePlugin({
      ...LynxTemplatePlugin.defaultOptions,
      chunks: ['e'],
      filename: 'e/template.js',
      intermediate: '.rspeedy/e',
      excludeChunks: ['b', 'c', 'd', 'a'],
    }),
  ],
};
