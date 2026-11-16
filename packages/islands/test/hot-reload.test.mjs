// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { rspack } from '@rsbuild/core';

import { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin';

import { pluginIslands } from '../lib/build/index.js';

const xml = ({ main = 1, background = 1, color = 'red' } = {}) =>
  `<lynx engine-version="4.2">
<style>.card { color: ${color}; }</style>
<script thread="main">module.exports = { create() { return ${main}; } };</script>
<script thread="background">module.exports = ${background};</script>
</lynx>`;

for (const hmr of [true, false]) {
  test(
    `XML-only changes update compilation hashes and sections with hmr=${hmr}`,
    { timeout: 30000 },
    async context => {
      const directory = mkdtempSync(join(tmpdir(), 'lynx-islands-reload-'));
      context.after(() => rmSync(directory, { recursive: true, force: true }));
      const source = join(directory, 'card.lynxml');
      const host = join(directory, 'index.cjs');
      writeFileSync(source, xml());
      writeFileSync(
        host,
        `module.exports = {
  value: 'host-exports',
  check: () => module.hot.check(true),
  status: () => module.hot.status(),
};
if (module.hot) module.hot.accept();`,
      );
      const config = {
        context: directory,
        mode: 'development',
        target: 'node',
        devtool: false,
        entry: {
          details: { import: [host], layer: 'react:background' },
        },
        output: {
          path: join(directory, 'dist'),
          filename: '[name].cjs',
          library: { type: 'commonjs2' },
          chunkLoading: 'async-node',
          hotUpdateChunkFilename: '[id].[fullhash].hot-update.cjs',
          hotUpdateMainFilename: '[runtime].[fullhash].hot-update.json',
        },
        optimization: { minimize: false, splitChunks: false },
        plugins: hmr ? [new rspack.HotModuleReplacementPlugin()] : [],
      };
      pluginIslands({ exposes: { card: source }, entry: 'details' }).setup({
        context: { rootPath: directory, action: 'dev' },
        modifyRspackConfig(callback) {
          callback(config, {
            environment: { name: 'lynx', config: { dev: { hmr } } },
          });
        },
      });
      const compiler = rspack(config);
      context.after(() =>
        new Promise((resolve, reject) => {
          compiler.close(error => error ? reject(error) : resolve());
        })
      );
      const changes = [
        xml({ main: 2 }),
        xml({ main: 2, background: 2 }),
        xml({ main: 2, background: 2, color: 'blue' }),
      ];
      const require = createRequire(import.meta.url);
      const bundle = join(directory, 'dist/details.cjs');
      let runtime;
      let previousHash;
      let previousSections;
      let builds = 0;
      await new Promise((resolve, reject) => {
        let pending = Promise.resolve();
        compiler.watch({ aggregateTimeout: 20 }, (error, stats) => {
          pending = pending.then(async () => {
            if (error) throw error;
            if (stats.hasErrors()) {
              throw new Error(stats.toString({ all: false, errors: true }));
            }
            if (stats.hash === previousHash) return;
            const { encodeData } = await LynxTemplatePlugin
              .getLynxTemplatePluginHooks(stats.compilation).beforeEncode
              .promise({
                chunkGroups: [{ name: 'details' }],
                encodeData: { customSections: {} },
              });
            const sections = encodeData.customSections;
            if (previousHash) {
              assert.notEqual(stats.hash, previousHash);
              const changedSection = ['main', 'background', 'css'][builds - 1];
              assert.notDeepEqual(
                sections[`card/${changedSection}`],
                previousSections[`card/${changedSection}`],
              );
              if (hmr) {
                // Reject XML updates even when the host entry accepts HMR.
                // The existing Lynx dev transport reloads the page on abort.
                await assert.rejects(runtime.check(), /self.declin/i);
                assert.equal(runtime.status(), 'abort');
              }
            }
            delete require.cache[require.resolve(bundle)];
            runtime = require(bundle);
            assert.equal(runtime.value, 'host-exports');
            previousHash = stats.hash;
            previousSections = sections;
            if (builds === changes.length) {
              resolve();
              return;
            }
            writeFileSync(source, changes[builds++]);
          }).catch(reject);
        });
      });
      assert.equal(builds, 3);
    },
  );
}
