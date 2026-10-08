// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { rspack } from '@rspack/core';
import type { Compiler, Configuration, Stats } from '@rspack/core';
import { describe, expect, test } from '@rstest/core';

import { CssExtractRspackPlugin } from '@lynx-js/css-extract-webpack-plugin';
import { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin';

import { mockLynxEncodePlugin } from './plugins.js';

const CONTEXT = path.dirname(fileURLToPath(import.meta.url));

function perTemplateEncodeOptionsPlugin() {
  return {
    name: 'PerTemplateEncodeOptionsPlugin',
    apply(compiler: Compiler) {
      compiler.hooks.thisCompilation.tap(
        'PerTemplateEncodeOptionsPlugin',
        (compilation) => {
          const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(
            compilation,
          );
          hooks.beforeEmit.tap('PerTemplateEncodeOptionsPlugin', (args) => {
            args.finalEncodeOptions['futureTemplateField'] =
              `future:${args.outputName}`;
            args.finalEncodeOptions.compilerOptions['futureCompilerOption'] =
              `future:${args.outputName}`;
            const sourceContent = args.finalEncodeOptions[
              'sourceContent'
            ] as Record<string, unknown>;
            sourceContent['futureSourceField'] = `future:${args.outputName}`;
            const config = sourceContent['config'] as Record<string, unknown>;
            config['debugMetadataUrl'] =
              `https://example.test/${args.outputName}.json`;
            config['futureConfigField'] = `future:${args.outputName}`;
            return args;
          });
        },
      );
    },
  };
}

function runRspack(config: Configuration): Promise<Stats> {
  const compiler = rspack(config);
  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      compiler.close(() => void 0);
      if (err) return reject(err);
      if (!stats) return reject(new Error('rspack returned empty stats'));
      if (stats.hasErrors()) {
        return reject(new Error(stats.toString({ all: false, errors: true })));
      }
      resolve(stats);
    });
  });
}

describe('CSS hot update encode options', () => {
  test('does not accept arbitrary per-template fields', async () => {
    const dist = mkdtempSync(path.join(tmpdir(), 'css-hot-update-options-'));
    const stats = await runRspack({
      context: CONTEXT,
      mode: 'development',
      devtool: false,
      experiments: { layers: true },
      entry: {
        main: {
          import: './fixtures/hot-update-encode-options/entry.js',
          layer: 'react:background',
          filename: '.lynx/main/background.js',
        },
      },
      output: {
        path: dist,
        publicPath: 'http://localhost:3001/',
        filename: '[name].js',
        chunkFilename: '.lynx/async/[name]/[name].js',
      },
      module: {
        rules: [
          {
            test: /\.css$/,
            use: [CssExtractRspackPlugin.loader, 'css-loader'],
          },
        ],
      },
      optimization: {
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            shared: {
              test: /[\\/]shared\.css$/,
              name: 'shared',
              minChunks: 2,
              minSize: 0,
              priority: 10,
            },
          },
        },
      },
      plugins: [
        new rspack.HotModuleReplacementPlugin(),
        mockLynxEncodePlugin(),
        new LynxTemplatePlugin({
          ...LynxTemplatePlugin.defaultOptions,
          intermediate: '.lynx/main',
        }),
        perTemplateEncodeOptionsPlugin(),
        new CssExtractRspackPlugin({
          filename: '.lynx/main/[name].css',
          chunkFilename: '.lynx/async/[name]/[name].css',
        }),
      ],
    });

    const { assets = [] } = stats.toJson({ assets: true });
    const hotUpdateAsset = assets.find(asset =>
      asset.name.endsWith('/shared.css.hot-update.json')
    );

    expect(hotUpdateAsset?.name).toBe(
      '.lynx/async/shared/shared.css.hot-update.json',
    );

    const hotUpdate = JSON.parse(
      readFileSync(path.join(dist, hotUpdateAsset!.name), 'utf-8'),
    ) as { content: string };
    const payload = JSON.parse(
      Buffer.from(hotUpdate.content, 'base64').toString('utf-8'),
    ) as {
      compilerOptions: Record<string, unknown>;
      sourceContent: Record<string, unknown> & {
        config: Record<string, unknown>;
      };
      futureTemplateField?: string;
    };

    expect(payload.futureTemplateField).toBeUndefined();
    expect(payload.compilerOptions['futureCompilerOption']).toBeUndefined();
    expect(payload.sourceContent['futureSourceField']).toBeUndefined();
    expect(payload.sourceContent.config['futureConfigField']).toBeUndefined();
    expect(payload.sourceContent.config['debugMetadataUrl']).toBeUndefined();
  });
});
