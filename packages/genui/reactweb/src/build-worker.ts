// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createRsbuild } from '@rsbuild/core';
import type { RsbuildPluginAPI, Rspack } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

import { validateReactWebAppSource } from './source-policy.js';

const cwd = process.argv[2];
if (!cwd) throw new Error('Missing build directory');
const appPath = path.join(cwd, 'App.tsx');
validateReactWebAppSource(await readFile(appPath, 'utf8'));

const rsbuild = await createRsbuild({
  cwd,
  rsbuildConfig: {
    mode: 'production',
    dev: { hmr: false },
    plugins: [
      pluginReact(),
      {
        name: 'genui-reactweb-css-policy',
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
      entry: { index: './index.tsx' },
      define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    },
    // Inline scripts do not honor defer; the mount node must already exist.
    html: { title: 'ReactWeb preview', inject: 'body' },
    output: {
      distPath: { root: 'dist' },
      sourceMap: { js: false, css: false },
      inlineScripts: true,
      inlineStyles: true,
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
                  if (data.contextInfo.issuer?.split('?')[0] !== appPath) {
                    return;
                  }
                  if (
                    !['react', 'react/jsx-runtime', 'react/jsx-dev-runtime']
                      .includes(data.request)
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
