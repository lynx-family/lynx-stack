// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Component-level `'background only'` on the MTS-defines assembly
 * infrastructure: a first-screen `App` that DELEGATES to background-only
 * components in other modules — `<Feed/>` (named import) and `<UI.Card/>`
 * (namespace import) — plus a `<Shared/>` component used by both trees and a
 * logic-only module reachable only from a background-only render body.
 *
 * The background-only modules compile as stub shells for the main thread
 * (exports survive as inert empty functions), and their element (snapshot) /
 * main-thread-script (worklet) definitions arrive through assembly, collected
 * while the background compiles them.
 *
 * A control build on the default in-place path proves two things: the
 * definition sets are identical (parity), and the assembly is what removes
 * the module top-level side effects from the main thread (the headline
 * behavior change).
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
  pluginOptions?: Record<string, unknown>,
) => RspackOptions;
type CreateEntries = (name?: string, source?: string) => RspackOptions['entry'];

const createConfig = rawCreateConfig as unknown as CreateConfig;
const createEntries = rawCreateEntries as unknown as CreateEntries;

async function buildAndCapture(
  loaderOptions: unknown,
  pluginOptions: Record<string, unknown>,
): Promise<Map<string, string>> {
  const base = createConfig(loaderOptions, {
    mainThreadChunks: ['main__main-thread.js'],
    ...pluginOptions,
  });
  const captured = new Map<string, string>();
  const config: RspackOptions = {
    ...base,
    mode: 'production',
    context: path.resolve(__dirname, 'fixtures/background-only-assembly'),
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

function snapshotIds(bundle: string): Set<string> {
  return new Set(bundle.match(/__snapshot_[0-9a-z]+_[0-9a-z]+_\d+/g) ?? []);
}

describe('component-level \'background only\' on the MTS-defines assembly', () => {
  let mainThread: string;
  let background: string;
  let controlMainThread: string;

  beforeAll(async () => {
    const assembled = await buildAndCapture(
      { experimental_backgroundOnlyAssembly: true },
      {
        experimental_backgroundOnlyAssembly: true,
        mainThreadEntries: { 'main__main-thread': 'main__background' },
      },
    );
    mainThread = assembled.get('main__main-thread.js') ?? '';
    background = assembled.get('main__background.js') ?? '';
    expect(mainThread).not.toBe('');
    expect(background).not.toBe('');

    const control = await buildAndCapture({}, {});
    controlMainThread = control.get('main__main-thread.js') ?? '';
    expect(controlMainThread).not.toBe('');
  });

  it('drops the background-only render bodies from the main thread', () => {
    expect(mainThread).not.toContain('FEED_BODY_LOGIC_MARKER');
    expect(mainThread).not.toContain('UI_CARD_BODY_LOGIC_MARKER');
    expect(mainThread).not.toContain('FEED_EFFECT_MARKER');
  });

  it('drops the background-only module top-level side effects from the main thread', () => {
    // The behavior change over the in-place strip: the whole module compiles
    // as a stub shell, so its top-level statements no longer run on the main
    // thread. The control assertion below proves the delta.
    expect(mainThread).not.toContain('FEED_TOP_LEVEL_SIDE_EFFECT_MARKER');
    expect(controlMainThread).toContain('FEED_TOP_LEVEL_SIDE_EFFECT_MARKER');
  });

  it('drops the logic-only import of a background-only module from the main thread', () => {
    expect(mainThread).not.toContain('HEAVY_FORMAT_LOGIC_ONLY_MARKER');
  });

  it('keeps the structural parent rendering on the main thread', () => {
    expect(mainThread).toContain('APP_BODY_LOGIC_MARKER');
  });

  it('assembles the named-import child\'s snapshot definition into the main thread', () => {
    expect(mainThread).toContain('var __initMTSDefines = function (');
    expect(mainThread).toContain('FEED_SNAPSHOT_STATIC_MARKER');
  });

  it('assembles the named-import child\'s worklet definition into the main thread', () => {
    expect(mainThread).toContain('registerWorkletInternal');
    expect(mainThread).toContain('SCROLL_WORKLET_MARKER');
  });

  it('assembles the namespace-import child\'s snapshot definition into the main thread', () => {
    expect(mainThread).toContain('UI_CARD_SNAPSHOT_STATIC_MARKER');
  });

  it('registers the shared component exactly once', () => {
    // In place from its own module; the background-scoped collection and the
    // in-place subtraction must not add a second registration.
    const occurrences = mainThread.match(/SHARED_SNAPSHOT_STATIC_MARKER/g);
    expect(occurrences).toHaveLength(1);
  });

  it('keeps the definition id set identical to the in-place implementation (parity)', () => {
    const assembledIds = snapshotIds(mainThread);
    const inPlaceIds = snapshotIds(controlMainThread);
    expect(assembledIds.size).toBeGreaterThan(0);
    expect([...assembledIds].sort()).toEqual([...inPlaceIds].sort());
  });

  it('leaves every module fully intact on the background bundle', () => {
    expect(background).toContain('FEED_TOP_LEVEL_SIDE_EFFECT_MARKER');
    expect(background).toContain('FEED_BODY_LOGIC_MARKER');
    expect(background).toContain('UI_CARD_BODY_LOGIC_MARKER');
    expect(background).toContain('HEAVY_FORMAT_LOGIC_ONLY_MARKER');
    expect(background).toContain('APP_BODY_LOGIC_MARKER');
  });

  it('registers the assembled definitions from inside the runtime', () => {
    // The runtime's `internal` module self-registers (gated by the
    // `__BACKGROUND_ONLY_ASSEMBLY__` define) instead of an extra entry
    // import, which would break scope hoisting of the main-thread chunk.
    expect(mainThread).toContain('__initMTSDefines({');
  });

  it('does not assemble on the control build', () => {
    // These builds skip minification, so the runtime's define-fenced
    // self-registration code is still present textually; what must be absent
    // is the assembled section itself (the runtime module defining
    // `__initMTSDefines`).
    expect(controlMainThread).not.toContain(
      'var __initMTSDefines = function (',
    );
  });
});
