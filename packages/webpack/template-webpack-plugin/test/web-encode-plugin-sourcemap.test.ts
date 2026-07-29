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
  // What the compilation would actually EMIT. `deleted` alone cannot answer the
  // question this plugin exists to answer: the cascade may delete the map and
  // the plugin may put it back, and only the final set decides whether a
  // developer gets a usable map.
  const live = new Map<string, AssetInfo>(assetsInfo);
  let processAssets: (() => void) | undefined;

  const compilation = {
    warnings: [],
    errors: [],
    chunks: [],
    outputOptions: {},
    getAsset: (name: string) => {
      if (!live.has(name)) return undefined;
      const info = assetsInfo.get(name);
      return info ? { name, source: {}, info } : undefined;
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
      live.delete(name);
      // Mirror the real cascade: deleteAsset also removes `related` assets.
      const related = assetsInfo.get(name)?.related?.sourceMap;
      if (related) {
        deleted.push(related);
        live.delete(related);
      }
    },
    emitAsset: (name: string, source: unknown, info?: AssetInfo) => {
      live.set(name, info ?? {});
      assetsInfo.set(name, info ?? assetsInfo.get(name) ?? {});
      void source;
    },
    updateAsset: (
      name: string,
      _source: unknown,
      update: (info: AssetInfo) => AssetInfo,
    ) => {
      const prev = assetsInfo.get(name) ?? {};
      // rspack's info updater does NOT clear `related`. Applying the updater
      // faithfully models webpack, not the runtime this plugin ships on — and
      // that gap is exactly why #3250 passed three green tests while changing
      // nothing. A driver that grants the detach its intended effect can only
      // ever agree with the approach that does not work.
      assetsInfo.set(name, { ...update(prev), related: prev.related });
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
  return { assetsInfo, deleted, live };
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
    const { live } = await drivePlugin(
      // The map must exist as an ASSET, not merely be named by `related`: the
      // fix captures its source through `getAsset(mapName)` before the delete.
      // Naming it without registering it makes that read undefined, the re-emit
      // guard short-circuits, and the test cannot pass against the fix it exists
      // to cover.
      new Map<string, AssetInfo>([
        ['background.js', { related: { sourceMap: 'background.js.map' } }],
        ['background.js.map', {}],
      ]),
    );

    // Asserted on what would be EMITTED, not on the deletion log. The cascade
    // may still take the map — what a developer gets is decided by the final
    // set, and the un-inlined JS must not ship as dead weight either.
    expect(live.has('background.js.map')).toBe(true);
    expect(live.has('background.js')).toBe(false);
  });

  // Detaching `related.sourceMap` before the delete was the obvious fix and it
  // does not work: on rspack, `updateAsset`'s info updater does not clear
  // `related`, so the cascade still fires and the map still disappears. The
  // plugin therefore takes a reference to the map before the delete and emits
  // it back afterwards, which depends on nothing but `emitAsset`.
  //
  // This case pins that the outcome does NOT rely on the link being cleared —
  // it holds whether or not `related` survives.
  test('the map is restored even though the related link still points at it', async () => {
    const { assetsInfo, deleted, live } = await drivePlugin(
      // The map must exist as an ASSET, not merely be named by `related`: the
      // fix captures its source through `getAsset(mapName)` before the delete.
      // Naming it without registering it makes that read undefined, the re-emit
      // guard short-circuits, and the test cannot pass against the fix it exists
      // to cover.
      new Map<string, AssetInfo>([
        ['background.js', { related: { sourceMap: 'background.js.map' } }],
        ['background.js.map', {}],
      ]),
    );

    expect(assetsInfo.get('background.js')?.related?.sourceMap)
      .toBe('background.js.map');
    expect(deleted).toContain('background.js.map');
    expect(live.has('background.js.map')).toBe(true);
  });

  test('an inlined asset with no source map is deleted unchanged', async () => {
    const { deleted } = await drivePlugin(new Map([['background.js', {}]]));

    expect(deleted).toEqual(['/main.js', 'background.js']);
  });
});
