import { fileURLToPath } from 'node:url';

import { LynxTemplatePlugin, WebEncodePlugin } from '../../../../lib/index.js';

// `a` is inlined into the encoded template and its standalone `a/a.js` is
// deleted. `deleteAsset` also drops everything in `assetInfo.related`, which is
// where `SourceMapDevToolPlugin` records the sidecar — so `a/a.js.map` used to
// disappear with it and background frames could not be symbolicated.
// See lynx-family/lynx-stack#2964.
//
// `b` is NOT inlined, so its map survives either way. The assertion below names
// `a/a.js.map` on purpose: asserting "some .map exists" would pass without the
// fix.
export default {
  entry: {
    a: './a.js',
    b: './b.js',
  },
  // `.pathname` on a file: URL yields a leading-slash path (/D:/...) on Windows,
  // which rspack cannot resolve against. Every other case fixture in this
  // package has the same line; this one does not, so it can run on Windows too.
  context: fileURLToPath(new URL('.', import.meta.url)),
  devtool: 'source-map',
  output: {
    filename: '[name]/[name].js',
  },
  plugins: [
    new WebEncodePlugin(),
    new LynxTemplatePlugin({
      ...LynxTemplatePlugin.defaultOptions,
      chunks: ['a'],
      filename: 'a/template.js',
      intermediate: '.rspeedy/a',
    }),

    compiler => {
      const { Compilation } = compiler.webpack;
      compiler.hooks.thisCompilation.tap('assert-sidecar-map', compilation => {
        compilation.hooks.processAssets.tap({
          name: 'assert-sidecar-map',
          // One stage after WebEncodePlugin's deletion, so this sees the set
          // that would actually be emitted.
          stage: Compilation.PROCESS_ASSETS_STAGE_REPORT + 2,
        }, assets => {
          const names = Object.keys(assets);
          if (names.includes('a/a.js')) {
            compilation.errors.push(
              new Error('a/a.js should have been inlined and deleted'),
            );
          }
          if (!names.includes('a/a.js.map')) {
            compilation.errors.push(
              new Error(
                'a/a.js.map was deleted with the asset it belongs to; emitted: '
                  + names.filter(n => n.endsWith('.map')).join(', '),
              ),
            );
          }
        });
      });
    },
  ],
};
