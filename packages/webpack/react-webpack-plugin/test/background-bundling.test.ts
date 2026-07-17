// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * L3 completeness proof: a `<Background>` boundary whose deferred subtree is a
 * cross-module component authored with the `'background only'` directive.
 *
 * The main-thread (LEPUS) bundle must:
 * - NOT contain the subtree's render logic or its logic-only imports (so no
 *   side-effect can leak onto the main thread), and
 * - still contain the subtree's element (snapshot) and main-thread-script
 *   (worklet) definitions, which the first-screen hydration needs to build the
 *   real content on the main thread.
 *
 * This is the "strip render logic, keep snapshot + MTS" guarantee, verified
 * cross-module against the real bundle (not just the transform output).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { rspack } from '@rspack/core';
import type { Compilation, Compiler, RspackOptions } from '@rspack/core';
import { beforeAll, describe, expect, it } from '@rstest/core';

// @ts-expect-error – JS helper has no type declarations
import { createConfig as rawCreateConfig, createEntries as rawCreateEntries } from './create-react-config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type CreateConfig = (
  loaderOptions?: unknown,
  pluginOptions?: { mainThreadChunks?: string[] },
) => RspackOptions;
type CreateEntries = (name?: string, source?: string) => RspackOptions['entry'];

const createConfig = rawCreateConfig as unknown as CreateConfig;
const createEntries = rawCreateEntries as unknown as CreateEntries;

async function buildAndCapture(): Promise<Map<string, string>> {
  const base = createConfig(undefined, {
    mainThreadChunks: ['main__main-thread.js'],
  });
  const captured = new Map<string, string>();
  const config: RspackOptions = {
    ...base,
    mode: 'production',
    context: path.resolve(__dirname, 'fixtures/background-bundling'),
    entry: createEntries('main', './index.jsx'),
    output: { filename: '[name].js' },
    optimization: { ...base.optimization, minimize: false },
    plugins: [
      ...(base.plugins ?? []),
      {
        apply(compiler: Compiler) {
          compiler.hooks.compilation.tap('CapturePlugin', (compilation: Compilation) => {
            compilation.hooks.processAssets.tap(
              {
                name: 'CapturePlugin',
                stage: compiler.rspack.Compilation.PROCESS_ASSETS_STAGE_REPORT,
              },
              (assets) => {
                for (const name of Object.keys(assets)) {
                  if (name.endsWith('.js')) {
                    captured.set(name, assets[name]!.source().toString());
                  }
                }
              },
            );
          });
        },
      },
    ],
  };

  const compiler = rspack(config);
  await new Promise<void>((resolve, reject) => {
    compiler.run((err, stats) => {
      const runErr = err ?? (stats?.hasErrors() ? new Error(stats.toString()) : undefined);
      compiler.close(closeErr => {
        if (runErr ?? closeErr) reject(runErr ?? closeErr!);
        else resolve();
      });
    });
  });
  return captured;
}

describe('<Background> bundling separation (L3)', () => {
  let mainThread: string;
  let background: string;

  beforeAll(async () => {
    const assets = await buildAndCapture();
    mainThread = assets.get('main__main-thread.js') ?? '';
    background = assets.get('main__background.js') ?? '';
    expect(mainThread).not.toBe('');
    expect(background).not.toBe('');
  });

  it('strips the deferred subtree render logic from the main-thread bundle', () => {
    expect(mainThread).not.toContain('FEED_RENDER_LOGIC_MARKER');
  });

  it('strips the deferred subtree logic-only imports from the main-thread bundle', () => {
    expect(mainThread).not.toContain('HEAVY_FORMAT_LOGIC_ONLY_MARKER');
  });

  it('keeps the deferred subtree element (snapshot) definitions in the main-thread bundle', () => {
    // The scroll-view element factory must remain so hydration can build it.
    expect(mainThread).toContain('__CreateScrollView');
  });

  it('keeps the deferred subtree main-thread-script (worklet) in the main-thread bundle', () => {
    expect(mainThread).toContain('registerWorkletInternal("main-thread"');
    expect(mainThread).toContain('SCROLL_WORKLET_MARKER');
  });

  it('leaves the deferred subtree fully intact on the background bundle', () => {
    expect(background).toContain('FEED_RENDER_LOGIC_MARKER');
    expect(background).toContain('HEAVY_FORMAT_LOGIC_ONLY_MARKER');
  });
});
