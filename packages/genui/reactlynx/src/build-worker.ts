// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// This is a separate Node entrypoint. Only package-owned configuration executes.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createRsbuild } from '@rsbuild/core';
import type { RsbuildPluginAPI, Rspack } from '@rsbuild/core';

import { pluginLynxConfig } from '@lynx-js/config-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { pluginLynx } from '@lynx-js/rsbuild-plugin';

import { validateReactLynxAppSource } from './source-policy.js';

const cwd = process.argv[2];
if (!cwd) throw new Error('Missing build directory');
const appPath = path.join(cwd, 'App.tsx');
validateReactLynxAppSource(await readFile(appPath, 'utf8'));

const rsbuild = await createRsbuild({
  cwd,
  rsbuildConfig: {
    mode: 'production',
    dev: { hmr: false },
    plugins: [
      pluginLynx({
        output: { filename: { bundle: '[name].[platform].js' } },
      }),
      pluginReactLynx({ defaultDisplayLinear: false }),
      pluginLynxConfig({ enableCSSInlineVariables: true }),
      {
        name: 'genui-css-policy',
        setup(api: RsbuildPluginAPI) {
          api.modifyRsbuildConfig(config => {
            config.tools ??= {};
            config.tools.cssLoader = {
              url: false,
              import: false,
              modules: false,
            };
          });
        },
      },
    ],
    source: {
      entry: { main: './index.tsx' },
      define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    },
    environments: { web: {}, lynx: {} },
    output: {
      distPath: { root: 'dist' },
      sourceMap: { js: false, css: false },
      minify: true,
    },
    tools: {
      rspack(config) {
        config.plugins ??= [];
        config.plugins.push({
          apply(compiler: Rspack.Compiler) {
            compiler.hooks.normalModuleFactory.tap(
              'GenuiSourceBoundary',
              factory => {
                factory.hooks.beforeResolve.tap('GenuiSourceBoundary', data => {
                  if (
                    data.contextInfo.issuer?.split('?')[0] !== appPath
                  ) return;
                  if (
                    ![
                      '@lynx-js/react',
                      '@lynx-js/react/jsx-runtime',
                      '@lynx-js/react/jsx-dev-runtime',
                    ].includes(data.request)
                  ) {
                    throw new Error(
                      'Generated source requested an unsupported module',
                    );
                  }
                });
              },
            );
          },
        });
      },
    },
  },
});
await rsbuild.build();
