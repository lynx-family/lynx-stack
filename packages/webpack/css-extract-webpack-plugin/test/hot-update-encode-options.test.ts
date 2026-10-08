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

// Sets `debugMetadataUrl` per template, as `LynxDebugMetadataPlugin` does.
function debugMetadataUrlPlugin() {
  return {
    name: 'DebugMetadataUrlPlugin',
    apply(compiler: Compiler) {
      compiler.hooks.thisCompilation.tap(
        'DebugMetadataUrlPlugin',
        (compilation) => {
          const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(
            compilation,
          );
          hooks.beforeEncode.tap('DebugMetadataUrlPlugin', (args) => {
            args.encodeData.sourceContent.config['debugMetadataUrl'] =
              `https://example.test/${args.intermediate}.json`;
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
  test('does not include debugMetadataUrl', async () => {
    const dist = mkdtempSync(path.join(tmpdir(), 'css-hot-update-options-'));

    // Two lazy bundle templates share one async CSS chunk and both write its
    // hot-update file.
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
        debugMetadataUrlPlugin(),
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
    ) as { sourceContent: { config: Record<string, unknown> } };

    expect(payload.sourceContent.config['debugMetadataUrl']).toBeUndefined();
  });
});
