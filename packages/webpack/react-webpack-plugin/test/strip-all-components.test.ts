// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * L4 completeness proof: a root-level `<Background>` (a 0.0 first screen) with
 * ZERO per-component annotations, driven purely by the `stripAllComponents`
 * loader option — the compile-time half of the whole-program optimization.
 *
 * With the strip active, the main-thread (LEPUS) bundle must:
 * - NOT contain ANY component's render logic (no `'background only'` markers
 *   were used — the strip empties every component body), nor the logic-only
 *   imports that only render bodies reached, and
 * - still contain the element (snapshot) and main-thread-script (worklet)
 *   definitions — hoisted to module scope before the strip — so first-screen
 *   hydration can build the real content on the main thread, and
 * - still contain the static host-element `fallback`, which is what the main
 *   thread actually renders for the 0.0 first screen.
 *
 * A control build WITHOUT the option proves the render logic is only absent
 * because of the strip, not because it was never bundled.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { rspack } from '@rspack/core';
import type { Compilation, Compiler, RspackOptions } from '@rspack/core';
import { beforeAll, describe, expect, it } from '@rstest/core';

// @ts-expect-error – JS helper has no type declarations
import {
  createConfig as rawCreateConfig,
  createEntries as rawCreateEntries,
} from './create-react-config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type CreateConfig = (
  loaderOptions?: unknown,
  pluginOptions?: { mainThreadChunks?: string[] },
) => RspackOptions;
type CreateEntries = (name?: string, source?: string) => RspackOptions['entry'];

const createConfig = rawCreateConfig as unknown as CreateConfig;
const createEntries = rawCreateEntries as unknown as CreateEntries;

async function buildAndCapture(
  loaderOptions: unknown,
): Promise<Map<string, string>> {
  const base = createConfig(loaderOptions, {
    mainThreadChunks: ['main__main-thread.js'],
  });
  const captured = new Map<string, string>();
  const config: RspackOptions = {
    ...base,
    mode: 'production',
    context: path.resolve(__dirname, 'fixtures/strip-all-components'),
    entry: createEntries('main', './index.jsx'),
    output: { filename: '[name].js' },
    optimization: { ...base.optimization, minimize: false },
    plugins: [
      ...(base.plugins ?? []),
      {
        apply(compiler: Compiler) {
          compiler.hooks.compilation.tap(
            'CapturePlugin',
            (compilation: Compilation) => {
              compilation.hooks.processAssets.tap(
                {
                  name: 'CapturePlugin',
                  stage:
                    compiler.rspack.Compilation.PROCESS_ASSETS_STAGE_REPORT,
                },
                (assets) => {
                  for (const name of Object.keys(assets)) {
                    if (name.endsWith('.js')) {
                      captured.set(name, assets[name]!.source().toString());
                    }
                  }
                },
              );
            },
          );
        },
      },
    ],
  };

  const compiler = rspack(config);
  await new Promise<void>((resolve, reject) => {
    compiler.run((err, stats) => {
      const runErr = err
        ?? (stats?.hasErrors() ? new Error(stats.toString()) : undefined);
      compiler.close(closeErr => {
        if (runErr ?? closeErr) reject(runErr ?? closeErr!);
        else resolve();
      });
    });
  });
  return captured;
}

describe('root <Background> whole-program strip (L4)', () => {
  let mainThread: string;
  let background: string;
  let controlMainThread: string;

  beforeAll(async () => {
    const stripped = await buildAndCapture({ stripAllComponents: true });
    mainThread = stripped.get('main__main-thread.js') ?? '';
    background = stripped.get('main__background.js') ?? '';
    expect(mainThread).not.toBe('');
    expect(background).not.toBe('');

    const control = await buildAndCapture({ stripAllComponents: false });
    controlMainThread = control.get('main__main-thread.js') ?? '';
    expect(controlMainThread).not.toBe('');
  });

  it('empties every component render body from the main-thread bundle', () => {
    // No component used `'background only'`; the strip empties them all. The
    // in-body computed value (a dynamic text binding, not a hoisted snapshot)
    // is gone.
    expect(mainThread).not.toContain('APP_BODY_LOGIC_MARKER');
  });

  it('shakes the logic-only imports that only render bodies reached', () => {
    expect(mainThread).not.toContain('HEAVY_FORMAT_LOGIC_ONLY_MARKER');
  });

  it('keeps the element (snapshot) definitions in the main-thread bundle', () => {
    // The scroll-view factory must remain so hydration can build it.
    expect(mainThread).toContain('__CreateScrollView');
  });

  it('keeps the main-thread-script (worklet) in the main-thread bundle', () => {
    expect(mainThread).toContain('registerWorkletInternal("main-thread"');
    expect(mainThread).toContain('SCROLL_WORKLET_MARKER');
  });

  it('keeps the static host-element fallback (what the 0.0 first screen renders)', () => {
    expect(mainThread).toContain('LOADING_FALLBACK_MARKER');
  });

  it('leaves every component fully intact on the background bundle', () => {
    // The strip is LEPUS-only; the background renders and hydrates everything.
    expect(background).toContain('APP_BODY_LOGIC_MARKER');
    expect(background).toContain('APP_EFFECT_MARKER');
    expect(background).toContain('HEAVY_FORMAT_LOGIC_ONLY_MARKER');
  });

  it('control build (no strip) keeps the render logic — proving the strip is the cause', () => {
    expect(controlMainThread).toContain('APP_BODY_LOGIC_MARKER');
    expect(controlMainThread).toContain('HEAVY_FORMAT_LOGIC_ONLY_MARKER');
  });
});
