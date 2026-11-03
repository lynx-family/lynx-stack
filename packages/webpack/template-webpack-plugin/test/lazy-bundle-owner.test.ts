// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

import { rspack } from '@rspack/core';
import type { Compiler, Stats } from '@rspack/core';
import { describe, expect, onTestFinished, test } from '@rstest/core';

import { RuntimeGlobals } from '@lynx-js/webpack-runtime-globals';

import { LynxEncodePlugin, LynxTemplatePlugin } from '../src/index.js';

const context = dirname(fileURLToPath(import.meta.url));

async function build(sharedName?: string) {
  const output = mkdtempSync(join(tmpdir(), 'tmpl-owner-'));
  onTestFinished(() => rmSync(output, { recursive: true, force: true }));
  const templates = new Map<string, string[]>();
  const compiler = rspack({
    context,
    mode: 'development',
    devtool: false,
    entry: {
      main: {
        import: './fixtures/lazy-bundle-owner/entry.js',
        layer: 'test:background',
        filename: '.lynx/main/background.js',
      },
    },
    output: {
      iife: false,
      path: output,
      chunkFilename: 'async/[name].js',
    },
    optimization: {
      chunkIds: 'named',
      splitChunks: {
        cacheGroups: {
          shared: {
            test: /[\\/]shared\.js$/,
            ...(sharedName ? { name: sharedName } : {}),
            minSize: 0,
            minChunks: 2,
          },
        },
      },
    },
    plugins: [
      new LynxTemplatePlugin({
        ...LynxTemplatePlugin.defaultOptions,
        filename: 'main.bundle',
      }),
      new LynxEncodePlugin(),
      (compiler: Compiler) => {
        compiler.hooks.thisCompilation.tap('test', compilation => {
          compilation.hooks.runtimeRequirementInTree.for(
            compiler.webpack.RuntimeGlobals.ensureChunkHandlers,
          ).tap('test', (_, requirements) => {
            requirements.add(RuntimeGlobals.lynxAsyncChunkIds);
          });
          LynxTemplatePlugin.getLynxTemplatePluginHooks(compilation)
            .beforeEncode.tap('test', data => {
              templates.set(
                data.filenameTemplate,
                Object.keys(data.encodeData.manifest),
              );
              return data;
            });
        });
      },
    ],
  });
  const stats = await new Promise<Stats>(
    (resolve, reject) => {
      compiler.run((error, stats) => {
        compiler.close(closeError => {
          if (error) return reject(error);
          if (closeError) return reject(closeError);
          if (!stats || stats.hasErrors()) {
            return reject(
              new Error(stats?.toString({ all: false, errors: true })),
            );
          }
          resolve(stats);
        });
      });
    },
  );
  return { stats, output, templates };
}

describe('lazy bundle owner', () => {
  test.each([undefined, 'shared', 'page-a'])(
    'keeps shared JS outside lazy bundles (cache group name: %s)',
    async sharedName => {
      const { stats, output, templates } = await build(sharedName);
      const chunks = stats.toJson({
        all: false,
        chunks: true,
        chunkModules: true,
      }).chunks!;
      const shared = chunks.find(chunk =>
        chunk.modules?.some(module => module.name?.endsWith('/shared.js'))
          === true
        || (sharedName !== undefined
          && chunk.names?.includes(sharedName) === true)
      )!;
      expect(shared).toBeDefined();
      expect(shared.files).toHaveLength(1);
      expect(shared.files![0]).toMatch(/^async\/.+\.js$/);
      const main = readFileSync(
        join(output, '.lynx/main/background.js'),
        'utf8',
      );
      const mapping = /__webpack_require__\.lynx_aci = (\{[^}]*\})/.exec(main);
      expect(mapping).not.toBeNull();
      const lazyChunks = runInNewContext(`(${mapping![1]!})`, {
        __webpack_require__: { h: () => stats.hash },
      }) as Record<string, string>;
      expect(Object.keys(lazyChunks)).not.toContain(String(shared.id));
      // A cache group named 'page-a' may absorb PageA's own chunk, so only
      // PageB keeps a lazy-bundle URL in that case.
      expect(Object.values(lazyChunks).sort()).toStrictEqual([
        `lazy-bundle/fixtures_lazy-bundle-owner_page-b.js.${stats.hash}.bundle`,
        ...(sharedName === 'page-a'
          ? []
          : [`lazy-bundle/page-a.${stats.hash}.bundle`]),
      ]);
      for (const filename of Object.values(lazyChunks)) {
        expect(stats.compilation.getAsset(filename)).toBeDefined();
      }
      for (const [name, files] of templates) {
        if (name.startsWith('lazy-bundle/')) {
          expect(files).not.toContain(shared.files![0]);
          if (sharedName === 'page-a' && name.includes('/page-a.')) {
            expect(files).toStrictEqual([]);
          } else {
            expect(files).toHaveLength(1);
            expect(files[0]).toMatch(
              /^\.lynx\/lazy-bundle\/.+\/background\.js$/,
            );
          }
        }
      }
      expect(
        [...templates.keys()].filter(name => name.startsWith('lazy-bundle/')),
      )
        .toHaveLength(2);
    },
  );
});
