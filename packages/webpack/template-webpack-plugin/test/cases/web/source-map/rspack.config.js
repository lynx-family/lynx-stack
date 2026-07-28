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
          // `a/a.js` surviving has TWO causes that want OPPOSITE fixes, so one
          // message for both is an instrument that reports the wrong failure:
          //
          //   - the encode ran and inlined it, but the delete did not happen
          //     -> the regression this case exists to catch;
          //   - the encode never ran, so `inlinedAssets` was empty and there was
          //     nothing to delete -> a broken build wearing the regression's
          //     clothes (e.g. web-core's encode binary missing).
          //
          // `a/template.js` is what the encode emits, so its presence tells them
          // apart. The full emitted list goes into every message regardless, so
          // the next run stays diagnostic even if that signal is ever wrong.
          const emitted = `emitted: ${names.join(', ')}`;
          const encodeRan = names.includes('a/template.js');
          if (names.includes('a/a.js')) {
            compilation.errors.push(
              new Error(
                encodeRan
                  ? `a/a.js was inlined into a/template.js but NOT deleted; ${emitted}`
                  : 'a/a.js survives because the encode never ran (no '
                    + `a/template.js) — a broken build, not a delete regression; ${emitted}`,
              ),
            );
          }
          if (!names.includes('a/a.js.map')) {
            compilation.errors.push(
              new Error(
                `a/a.js.map was deleted with the asset it belongs to; ${emitted}`,
              ),
            );
          }
        });
      });
    },
  ],
};
