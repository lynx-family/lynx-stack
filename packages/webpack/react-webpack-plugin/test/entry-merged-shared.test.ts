// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { rspack } from '@rspack/core';
import type { Compiler, RspackOptions } from '@rspack/core';
import { expect, onTestFinished, test } from '@rstest/core';

import { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin';

import { ReactWebpackPlugin } from '../src/ReactWebpackPlugin.js';
// @ts-expect-error – JS config has no type declarations
import rawConfig from './cases/code-splitting/entry-merged-shared/rspack.config.js';

const config = rawConfig as RspackOptions;

test.each([false, true])(
  'preserves entry wrapping with shared modules (standalone lazy bundle: %s)',
  async isLazyBundle => {
    const outputPath = mkdtempSync(path.join(tmpdir(), 'react-entry-merged-'));
    onTestFinished(() => rmSync(outputPath, { recursive: true, force: true }));
    const roots = new Map<string, string>();
    const plugins = [...config.plugins!];
    plugins[0] = new ReactWebpackPlugin({
      mainThreadChunks: ['main__main-thread.js'],
      experimental_isLazyBundle: isLazyBundle,
      LynxTemplatePlugin,
    });
    const compiler = rspack({
      ...config,
      mode: 'development',
      target: 'node',
      context: path.join(__dirname, 'fixtures/entry-merged-shared'),
      optimization: {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            defaultVendors: false,
            shared: {
              test: /[\\/]shared\.js$/,
              name: 'main__main-thread',
              layer: /main-thread/,
              enforce: true,
            },
          },
        },
      },
      output: {
        ...config.output,
        path: outputPath,
      },
      plugins: [
        ...plugins,
        (compiler: Compiler) => {
          compiler.hooks.thisCompilation.tap('test', compilation => {
            LynxTemplatePlugin.getLynxTemplatePluginHooks(compilation)
              .beforeEncode.tap('test', data => {
                const root = data.encodeData.lepusCode.root;
                if (root) {
                  roots.set(data.intermediate, root.source.source().toString());
                }
                return data;
              });
          });
        },
      ],
    });
    await new Promise<void>((resolve, reject) => {
      compiler.run((error, stats) => {
        compiler.close(closeError => {
          if (error) return reject(error);
          if (closeError) return reject(closeError);
          if (!stats || stats.hasErrors()) {
            return reject(
              new Error(stats?.toString({ all: false, errors: true })),
            );
          }
          resolve();
        });
      });
    });

    const entry = roots.get('.rspeedy/main');
    expect(entry).toBeDefined();
    expect(entry!.length).toBeGreaterThan(0);
    const wrapper = '(function (globDynamicComponentEntry)';
    expect(entry!.includes(wrapper), entry!.slice(0, 400)).toBe(isLazyBundle);
    const lazyRoots = [...roots].filter(([name]) => name !== '.rspeedy/main');
    expect(lazyRoots.length).toBeGreaterThan(0);
    for (const [, root] of lazyRoots) {
      expect(root).toContain(wrapper);
    }
  },
);
