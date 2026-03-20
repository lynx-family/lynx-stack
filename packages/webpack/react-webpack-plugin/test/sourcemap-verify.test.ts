// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';

import { rspack } from '@rspack/core';
import type { Compilation, Compiler, RspackOptions } from '@rspack/core';
import { describe, expect, it } from 'vitest';

import {
  LynxEncodePlugin,
  LynxTemplatePlugin,
} from '@lynx-js/template-webpack-plugin';

// @ts-expect-error – JS config has no type declarations
import lazyBundleRawConfig from './cases/main-thread/lazy-bundle-sourcemap/rspack.config.js';
// @ts-expect-error – JS helper has no type declarations
import { createConfig as rawCreateConfig } from './create-react-config.js';

type CreateConfig = (
  loaderOptions?: unknown,
  pluginOptions?: {
    mainThreadChunks?: string[];
    experimental_isLazyBundle?: boolean;
  },
) => RspackOptions;

const lazyBundleConfig = lazyBundleRawConfig as unknown as RspackOptions;
const createConfig = rawCreateConfig as unknown as CreateConfig;

const nonLazyBaseConfig = createConfig(undefined, {
  mainThreadChunks: ['main__main-thread.js'],
});
const nonLazyAsyncConfig = {
  ...nonLazyBaseConfig,
  devtool: 'source-map',
  optimization: {
    ...nonLazyBaseConfig.optimization,
    minimize: true,
  },
  plugins: [
    ...(nonLazyBaseConfig.plugins ?? []),
    new LynxEncodePlugin(),
    new LynxTemplatePlugin({
      ...LynxTemplatePlugin.defaultOptions,
      chunks: ['main__main-thread', 'main__background'],
      filename: 'main/template.js',
      intermediate: '.rspeedy/main',
    }),
  ],
} satisfies RspackOptions;

async function captureAssets(
  config: RspackOptions,
  context: string,
  matcher: (name: string) => boolean,
) {
  const capturedAssets = new Map<string, string>();
  const capturedMaps = new Map<
    string,
    { mappings: string; sources: string[] }
  >();

  const plugins: NonNullable<RspackOptions['plugins']> = [
    ...(config.plugins ?? []),
    {
      apply(compiler: Compiler) {
        compiler.hooks.compilation.tap(
          'TestPlugin',
          (compilation: Compilation) => {
            compilation.hooks.processAssets.tap(
              {
                name: 'TestPlugin',
                // Hook in after BannerPlugin wrapper injection, before final cleanup.
                stage: compiler.webpack.Compilation
                  .PROCESS_ASSETS_STAGE_DEV_TOOLING,
              },
              (assets) => {
                const jsFiles = Object.keys(assets).filter(name =>
                  matcher(name)
                );
                for (const file of jsFiles) {
                  capturedAssets.set(file, assets[file]!.source().toString());
                  const mapName = file + '.map';
                  if (assets[mapName]) {
                    capturedMaps.set(
                      file,
                      JSON.parse(
                        assets[mapName].source().toString(),
                      ) as { mappings: string; sources: string[] },
                    );
                  }
                }
              },
            );
          },
        );
      },
    },
  ];

  const testCompiler = rspack({
    ...config,
    context,
    plugins,
  });

  await new Promise<void>((resolve, reject) => {
    testCompiler.run((err, stats) => {
      if (err ?? stats?.hasErrors()) {
        reject(err ?? new Error(stats!.toString()));
        return;
      }
      resolve();
    });
  });

  return { capturedAssets, capturedMaps };
}

function expectWrappedAssets(
  capturedAssets: Map<string, string>,
  capturedMaps: Map<string, { mappings: string; sources: string[] }>,
) {
  for (const [filename, asset] of capturedAssets) {
    expect(asset, `${filename} should include wrapper header`).toContain(
      '(function (globDynamicComponentEntry)',
    );
    expect(asset, `${filename} should include wrapper footer`).toContain(
      ';return module.exports',
    );

    const capturedMap = capturedMaps.get(filename);
    expect(capturedMap, `${filename} sourcemap should exist`).toBeTruthy();

    // In a VLQ sourcemap, semicolons separate lines. Our wrapper is:
    //   Line 1: (function (globDynamicComponentEntry) {
    //   Line 2:   const module = { exports: {} }
    //   Line 3:   const exports = module.exports;
    // Real code starts on line 4 or later. So the first *non-empty* segment
    // group (split by ';') must be at index >= 3.
    const segments = capturedMap!.mappings.split(';');
    const firstNonEmpty = segments.findIndex(s => s.length > 0);

    expect(
      firstNonEmpty,
      `${filename} should shift mappings by at least 3 lines`,
    ).toBeGreaterThanOrEqual(3);
    expect(segments[firstNonEmpty]!.length).toBeGreaterThan(0);
  }
}

describe('Lazy Bundle Sourcemap Verification', () => {
  it('should verify main-thread.js has wrapper and a correctly-shifted sourcemap', async () => {
    const { capturedAssets, capturedMaps } = await captureAssets(
      lazyBundleConfig,
      path.join(__dirname, 'cases/main-thread/lazy-bundle-sourcemap'),
      name => name.includes('main-thread') && name.endsWith('.js'),
    );

    const mainThreadFiles = [...capturedAssets.keys()];

    // ── 1. Both initial and async main-thread assets were captured ─────────
    expect(
      mainThreadFiles,
      'Should capture the initial main-thread asset',
    ).toContain('main__main-thread.js');
    expect(
      mainThreadFiles.some(name => name.includes('react__main-thread')),
      'Should capture at least one async main-thread asset from dynamic import',
    ).toBe(true);

    expectWrappedAssets(capturedAssets, capturedMaps);
  });

  it('should verify non-lazy async main-thread chunks also shift sourcemaps after wrapper injection', async () => {
    const { capturedAssets, capturedMaps } = await captureAssets(
      nonLazyAsyncConfig,
      path.join(__dirname, 'cases/main-thread/lazy-bundle-sourcemap'),
      name => name.includes('react__main-thread') && name.endsWith('.js'),
    );

    const assetNames = [...capturedAssets.keys()];

    expect(
      assetNames.some(name => name.includes('lazy.jsx-react__main-thread')),
      'Should capture the async lazy main-thread chunk',
    ).toBe(true);

    expectWrappedAssets(capturedAssets, capturedMaps);
  });
});
