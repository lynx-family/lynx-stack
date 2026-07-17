// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * The multi-module hydration proof for the whole-program strip (the test L4
 * originally lacked): a root-level `<Background>` over an `App` that DELEGATES
 * to components in other modules — `<Feed/>` (named import) and `<UI.Card/>`
 * (namespace import) — with zero per-component annotations.
 *
 * Emptying `App`'s body must NOT sever its component references: the emptied
 * body hands them to a module-level keep-alive statement
 * (`typeof __ifrKeepComponentRefs === "function" && __ifrKeepComponentRefs(…)`),
 * so the child modules — carrying the hoisted element (snapshot) and
 * main-thread-script (worklet) definitions — stay in the main-thread bundle
 * and first-screen hydration can build the real tree.
 *
 * At the same time the strip must still deliver its size win: every render
 * body's logic and the logic-only imports (call targets like `formatFeed`)
 * must be absent from the main-thread bundle.
 *
 * A control build WITHOUT the strip proves absence is caused by the strip.
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
    context: path.resolve(__dirname, 'fixtures/strip-multi-module'),
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

describe('root <Background> whole-program strip over a multi-module tree (L4)', () => {
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

  it('empties every render body across all modules', () => {
    expect(mainThread).not.toContain('APP_BODY_LOGIC_MARKER');
    expect(mainThread).not.toContain('FEED_BODY_LOGIC_MARKER');
    expect(mainThread).not.toContain('UI_CARD_BODY_LOGIC_MARKER');
    expect(mainThread).not.toContain('FEED_EFFECT_MARKER');
  });

  it('still shakes the logic-only imports out of the main-thread bundle', () => {
    expect(mainThread).not.toContain('HEAVY_FORMAT_LOGIC_ONLY_MARKER');
  });

  it('emits the keep-alive that pins the delegated component modules', () => {
    expect(mainThread).toContain('__ifrKeepComponentRefs');
  });

  it('keeps the named-import child\'s snapshot definitions (hydration can build <Feed/>)', () => {
    expect(mainThread).toContain('__CreateScrollView');
    expect(mainThread).toContain('FEED_SNAPSHOT_STATIC_MARKER');
  });

  it('keeps the named-import child\'s worklet definition on the main thread', () => {
    expect(mainThread).toContain('registerWorkletInternal("main-thread"');
    expect(mainThread).toContain('SCROLL_WORKLET_MARKER');
  });

  it('keeps the namespace-import child\'s snapshot definitions (hydration can build <UI.Card/>)', () => {
    expect(mainThread).toContain('UI_CARD_SNAPSHOT_STATIC_MARKER');
  });

  it('keeps the static host-element fallback (the 0.0 first screen)', () => {
    expect(mainThread).toContain('LOADING_FALLBACK_MARKER');
  });

  it('leaves every module fully intact on the background bundle', () => {
    expect(background).toContain('APP_BODY_LOGIC_MARKER');
    expect(background).toContain('FEED_BODY_LOGIC_MARKER');
    expect(background).toContain('UI_CARD_BODY_LOGIC_MARKER');
    expect(background).toContain('HEAVY_FORMAT_LOGIC_ONLY_MARKER');
  });

  it('control build (no strip) keeps the render logic — proving the strip is the cause', () => {
    expect(controlMainThread).toContain('APP_BODY_LOGIC_MARKER');
    expect(controlMainThread).toContain('FEED_BODY_LOGIC_MARKER');
    expect(controlMainThread).toContain('HEAVY_FORMAT_LOGIC_ONLY_MARKER');
  });
});
