// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { SyncHook } from '@rspack/lite-tapable';
import { describe, expect, test } from '@rstest/core';
import webpack from 'webpack';

import { LynxTemplatePlugin, WebEncodePlugin } from '../src/index.js';

interface AssetInfo {
  related?: { sourceMap?: string | undefined };
}

async function drivePlugin(assetsInfo: Map<string, AssetInfo>) {
  // `lynxRstestConfig` sets `DEBUG=rspeedy` for every webpack test package so
  // debugging artifacts survive a run. That makes `isDebug()` true, and
  // WebEncodePlugin then inlines nothing and deletes nothing — the branch under
  // test never runs. Drop it for this driver only, and put it back afterwards
  // so the rest of the suite keeps the value the config intends.
  const debug = process.env['DEBUG'];
  delete process.env['DEBUG'];
  try {
    return await drive(assetsInfo);
  } finally {
    if (debug === undefined) delete process.env['DEBUG'];
    else process.env['DEBUG'] = debug;
  }
}

async function drive(assetsInfo: Map<string, AssetInfo>) {
  const deleted: string[] = [];
  let processAssets: (() => void) | undefined;

  const compilation = {
    warnings: [],
    errors: [],
    chunks: [],
    outputOptions: {},
    getAsset: (name: string) => {
      const info = assetsInfo.get(name);
      return info ? { name, source: undefined, info } : undefined;
    },
    hooks: {
      processAssets: {
        tap: (_options: unknown, callback: () => void) => {
          processAssets = callback;
        },
      },
    },
    deleteAsset: (name: string) => {
      deleted.push(name);
      // Mirror the real cascade: deleteAsset also removes `related` assets.
      const related = assetsInfo.get(name)?.related?.sourceMap;
      if (related) deleted.push(related);
    },
    updateAsset: (
      name: string,
      _source: unknown,
      update: (info: AssetInfo) => AssetInfo,
    ) => {
      assetsInfo.set(name, update(assetsInfo.get(name) ?? {}));
    },
  } as unknown as webpack.Compilation;

  const compiler = {
    options: { mode: 'production' },
    hooks: { thisCompilation: new SyncHook(['compilation']) },
    webpack,
  } as unknown as webpack.Compiler;

  new WebEncodePlugin().apply(compiler as never);
  compiler.hooks.thisCompilation.call(compilation, {} as never);

  // `beforeEncode` is an AsyncSeriesWaterfallHook, so it is driven with
  // `.promise()` — the same way LynxTemplatePlugin itself calls it.
  const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(
    compilation as never,
  );
  await hooks.beforeEncode.promise({
    encodeData: {
      manifest: { '/main.js': 'console.log(1)' },
      lepusCode: { root: undefined, chunks: [] },
      css: { chunks: [] },
      customSections: {},
      compilerOptions: {},
      sourceContent: { dsl: 'react', appType: 'app', config: {} },
    },
    intermediateAssets: ['background.js'],
  } as never);

  processAssets?.();
  return { deleted, assetsInfo };
}

describe('WebEncodePlugin: inlined assets keep their source maps', () => {
  // The background chunk is inlined into the encoded `.web.bundle` and its
  // standalone `.js` is deleted. `deleteAsset` also drops everything in
  // `assetInfo.related`, which is where SourceMapDevToolPlugin records the
  // sidecar `.map` — so `output.sourceMap.js: 'source-map'` and
  // 'hidden-source-map' produced NO map for background frames on the web
  // target, and only 'inline-source-map' worked, at ~10x bundle size.
  // See lynx-family/lynx-stack#2964.
  test('the sidecar .map survives while the inlined .js is still deleted', async () => {
    const { deleted } = await drivePlugin(
      new Map([['background.js', {
        related: { sourceMap: 'background.js.map' },
      }]]),
    );

    expect(deleted).toContain('background.js');
    expect(deleted).not.toContain('background.js.map');
  });

  test('the related link is detached rather than the deletion being skipped', async () => {
    const { assetsInfo } = await drivePlugin(
      new Map([['background.js', {
        related: { sourceMap: 'background.js.map' },
      }]]),
    );

    // The asset info must no longer point at the map, which is what stops the
    // cascade. Leaving the link and skipping deleteAsset would ship the
    // un-inlined JS as dead weight instead.
    expect(assetsInfo.get('background.js')?.related?.sourceMap).toBeUndefined();
  });

  test('an inlined asset with no source map is deleted unchanged', async () => {
    const { deleted } = await drivePlugin(new Map([['background.js', {}]]));

    expect(deleted).toEqual(['/main.js', 'background.js']);
  });
});
