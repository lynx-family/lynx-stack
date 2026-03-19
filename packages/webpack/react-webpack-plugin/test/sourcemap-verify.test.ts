// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';

import { rspack } from '@rspack/core';
import type { Compilation, Compiler, RspackOptions } from '@rspack/core';
import { describe, expect, it } from 'vitest';

// @ts-expect-error – JS config has no type declarations
import rawConfig from './cases/main-thread/lazy-bundle-sourcemap/rspack.config.js';

const config = rawConfig as RspackOptions;

describe('Lazy Bundle Sourcemap Verification', () => {
  it('should verify main-thread.js has wrapper and a correctly-shifted sourcemap', async () => {
    let capturedAsset: string | null = null;
    let capturedMap: { mappings: string; sources: string[] } | null = null;
    let mainThreadFile = '';

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
                  // Hook in after BannerPlugin (Stage 401), before final cleanup.
                  stage: compiler.webpack.Compilation
                    .PROCESS_ASSETS_STAGE_DEV_TOOLING,
                },
                (assets) => {
                  const jsFiles = Object.keys(assets).filter(
                    n => n.includes('main-thread') && n.endsWith('.js'),
                  );
                  if (jsFiles.length > 0) {
                    mainThreadFile = jsFiles[0]!;
                    capturedAsset = assets[mainThreadFile]!.source().toString();
                    const mapName = mainThreadFile + '.map';
                    if (assets[mapName]) {
                      capturedMap = JSON.parse(
                        assets[mapName].source().toString(),
                      ) as { mappings: string; sources: string[] };
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
      context: path.join(__dirname, 'cases/main-thread/lazy-bundle-sourcemap'),
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

    // ── 1. File was captured ────────────────────────────────────────────────
    expect(mainThreadFile, 'Should find a main-thread JS asset').toBeTruthy();

    // ── 2. Wrapper is present in generated code ─────────────────────────────
    // The BannerPlugin should have prepended the IIFE header and appended the footer.
    expect(capturedAsset).toContain('(function (globDynamicComponentEntry)');
    expect(capturedAsset).toContain(';return module.exports');

    // ── 3. Sourcemap is non-empty ───────────────────────────────────────────
    expect(capturedMap, 'Sourcemap should exist').toBeTruthy();

    // ── 4. Sourcemap is shifted by (at least) 3 lines ──────────────────────
    // In a VLQ sourcemap, semicolons separate lines. Our wrapper is:
    //   Line 1: (function (globDynamicComponentEntry) {
    //   Line 2:   const module = { exports: {} }
    //   Line 3:   const exports = module.exports;
    // Real code starts on line 4 or later. So the first *non-empty* segment
    // group (split by ';') must be at index >= 3.
    const segments = capturedMap!.mappings.split(';');
    const firstNonEmpty = segments.findIndex(s => s.length > 0);

    expect(firstNonEmpty).toBeGreaterThanOrEqual(3);
    expect(segments[firstNonEmpty]!.length).toBeGreaterThan(0);
  });
});
