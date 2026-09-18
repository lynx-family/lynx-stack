// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { SyncHook } from '@rspack/lite-tapable';
import { describe, expect, test } from '@rstest/core';
import webpack from 'webpack';

import { LynxTemplatePlugin, WebEncodePlugin } from '../src/index.js';

async function inlinedManifestOf(appType: 'app' | 'DynamicComponent') {
  // `lynxRstestConfig` sets `DEBUG=rspeedy`, under which the plugin inlines
  // nothing; see web-encode-plugin-sourcemap.test.ts.
  const debug = process.env['DEBUG'];
  delete process.env['DEBUG'];
  try {
    return await drive(appType);
  } finally {
    if (debug === undefined) delete process.env['DEBUG'];
    else process.env['DEBUG'] = debug;
  }
}

async function drive(appType: 'app' | 'DynamicComponent') {
  const deleted: string[] = [];
  let processAssets: (() => void) | undefined;

  const compilation = {
    warnings: [],
    errors: [],
    chunks: [],
    outputOptions: {},
    getAsset: (name: string) => ({ name, source: {}, info: {} }),
    hooks: {
      processAssets: {
        tap: (_options: unknown, callback: () => void) => {
          processAssets = callback;
        },
      },
    },
    deleteAsset: (name: string) => {
      deleted.push(name);
    },
    emitAsset: () => void 0,
    updateAsset: () => void 0,
  } as unknown as webpack.Compilation;

  const compiler = {
    options: { mode: 'production' },
    hooks: { thisCompilation: new SyncHook(['compilation']) },
    webpack,
  } as unknown as webpack.Compiler;

  new WebEncodePlugin().apply(compiler as never);
  compiler.hooks.thisCompilation.call(compilation, {} as never);

  const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(
    compilation as never,
  );
  await hooks.beforeEncode.promise({
    encodeData: {
      manifest: { '/a.js': 'a', '/b.js': 'b' },
      lepusCode: { root: undefined, chunks: [] },
      css: { chunks: [] },
      customSections: {},
      compilerOptions: {},
      sourceContent: { dsl: 'react', appType, config: {} },
    },
    intermediateAssets: [],
  } as never);

  processAssets?.();
  return deleted;
}

describe('WebEncodePlugin: inlined manifest', () => {
  test('a bundle assembled from sections inlines every background chunk', async () => {
    expect(await inlinedManifestOf('DynamicComponent')).toStrictEqual([
      '/a.js',
      '/b.js',
    ]);
  });

  test('a card keeps its split chunks and inlines the last one', async () => {
    expect(await inlinedManifestOf('app')).toStrictEqual(['/b.js']);
  });
});
