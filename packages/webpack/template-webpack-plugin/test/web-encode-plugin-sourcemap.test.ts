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

interface Asset {
  source: string;
  info: AssetInfo;
}

async function drivePlugin(assets: Map<string, Asset>) {
  // `lynxRstestConfig` sets `DEBUG=rspeedy` for every webpack test package so
  // debugging artifacts survive a run. That makes `isDebug()` true, and
  // WebEncodePlugin then inlines nothing and deletes nothing — the branch under
  // test never runs. Drop it for this driver only, and put it back afterwards
  // so the rest of the suite keeps the value the config intends.
  const debug = process.env['DEBUG'];
  delete process.env['DEBUG'];
  try {
    return await drive(assets);
  } finally {
    if (debug === undefined) delete process.env['DEBUG'];
    else process.env['DEBUG'] = debug;
  }
}

async function drive(assets: Map<string, Asset>) {
  const deleted: string[] = [];

  let processAssets: (() => void) | undefined;

  const compilation = {
    warnings: [],
    errors: [],
    chunks: [],
    outputOptions: {},
    assets: Object.fromEntries(
      [...assets].map(([name, asset]) => [name, asset.source]),
    ),
    getAsset: (name: string) => {
      const asset = assets.get(name);
      return asset
        ? { name, source: asset.source, info: asset.info }
        : undefined;
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
      // The real cascade: deleteAsset also drops everything in `related`.
      const related = assets.get(name)?.info.related?.sourceMap;
      assets.delete(name);
      if (related) {
        deleted.push(related);
        assets.delete(related);
      }
    },
    emitAsset: (name: string, source: string, info: AssetInfo = {}) => {
      assets.set(name, { source, info });
    },
    // rspack ignores an `info` updater that tries to clear `related` — verified
    // against rspack 2.1.2 on 2026-07-27 by reading `info.related.sourceMap`
    // back immediately after the call and finding it unchanged. Modelling this
    // as a plain mutable object is what let a "detach the link, then delete"
    // fix pass its tests while changing nothing about the emitted output.
    updateAsset: (name: string, update: (source: string) => string) => {
      const asset = assets.get(name);
      if (asset) asset.source = update(asset.source);
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
  return { deleted, assets };
}

/** An asset whose `related.sourceMap` link cannot be rewritten, as on rspack. */
function withMap(source: string, sourceMap: string): Asset {
  return { source, info: { related: { sourceMap } } };
}

function plain(source: string): Asset {
  return { source, info: {} };
}

describe('WebEncodePlugin: inlined assets keep their source maps', () => {
  // The background chunk is inlined into the encoded `.web.bundle` and its
  // standalone `.js` is deleted. `deleteAsset` also drops everything in
  // `assetInfo.related`, which is where SourceMapDevToolPlugin records the
  // sidecar `.map` — so `output.sourceMap.js: 'source-map'` and
  // 'hidden-source-map' produced NO map for background frames on the web
  // target, and only 'inline-source-map' worked, at ~10x bundle size.
  // See lynx-family/lynx-stack#2964.
  test('the sidecar .map is still emitted after the inlined .js is deleted', async () => {
    const { assets } = await drivePlugin(
      new Map([
        ['background.js', withMap('bg', 'background.js.map')],
        ['background.js.map', plain('{"version":3}')],
      ]),
    );

    // This is the assertion that matters: the map is in the final asset set.
    // Asserting only that it was never passed to `deleteAsset` would pass for
    // an implementation that deletes it through the `related` cascade.
    expect(assets.has('background.js.map')).toBe(true);
    expect(assets.get('background.js.map')?.source).toBe('{"version":3}');
  });

  test('the inlined .js itself is still deleted', async () => {
    const { assets, deleted } = await drivePlugin(
      new Map([
        ['background.js', withMap('bg', 'background.js.map')],
        ['background.js.map', plain('{"version":3}')],
      ]),
    );

    // Keeping the map must not turn into keeping the JS: it is already inlined
    // in the template, so shipping it too would be dead weight.
    expect(deleted).toContain('background.js');
    expect(assets.has('background.js')).toBe(false);
  });

  test('an inlined asset with no source map is deleted unchanged', async () => {
    const { assets, deleted } = await drivePlugin(
      new Map([['background.js', plain('bg')]]),
    );

    expect(deleted).toEqual(['/main.js', 'background.js']);
    expect(assets.size).toBe(0);
  });
});
