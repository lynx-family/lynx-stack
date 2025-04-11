import fs from 'node:fs';

import { LynxEncodePlugin, LynxTemplatePlugin } from '../../../../src';

/** @type {import('webpack').Configuration} */
export default {
  mode: 'production',
  target: 'node',
  output: {
    publicPath: 'https://example.com/',
    filename: '[name].bundle.js',
    chunkFilename: 'async/[name].bundle.js',
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      minSize: 0,
      cacheGroups: {
        shared: {
          test: /shared/,
          name: 'shared',
        },
      },
    },
  },
  plugins: [
    new LynxEncodePlugin(),
    new LynxTemplatePlugin({
      filename: 'template.js',
      intermediate: '.rspeedy/main',
    }),

    compiler => {
      const { DEBUG, NODE_ENV } = process.env;
      compiler.hooks.beforeCompile.tap('test', () => {
        process.env['DEBUG'] = '';
        process.env['NODE_ENV'] = 'production';
      });

      // Reset
      compiler.hooks.emit.tap('test', () => {
        process.env['DEBUG'] = DEBUG;
        process.env['NODE_ENV'] = NODE_ENV;
      });
    },

    (compiler) => {
      compiler.hooks.thisCompilation.tap('test', (compilation) => {
        const encodeHooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(
          compilation,
        );
        let appService;
        encodeHooks.beforeEmit.tap('test', (args) => {
          appService = args.finalEncodeOptions.manifest['/app-service.js'];
        });
        encodeHooks.afterEmit.tap('test', ({ outputName }) => {
          compilation.updateAsset(
            outputName,
            new compiler.webpack.sources.RawSource(appService),
          );
        });

        compilation.hooks.processAssets.tap(
          { stage: 10000, name: 'test' },
          () => {
            expect(appService).not.toBeFalsy();
          },
        );
      });
    },

    compiler => {
      compiler.hooks.afterEmit.tap({
        name: 'test',
        stage: -128,
      }, () => {
        const files = fs.readdirSync(compiler.outputPath);
        expect(files).not.toContain('main.bundle.js');
      });

      compiler.hooks.thisCompilation.tap('test', (compilation) => {
        compiler.hooks.done.tap('test', () => {
          expect(Object.keys(compilation.assets)).not.toContain(
            'main.bundle.js',
          );
        });
      });
    },
  ],
};
