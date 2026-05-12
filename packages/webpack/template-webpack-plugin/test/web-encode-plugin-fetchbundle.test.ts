// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { SyncHook } from '@rspack/lite-tapable';
import { afterEach, beforeEach, describe, expect, test } from '@rstest/core';
import webpack from 'webpack';

import { LynxTemplatePlugin, WebEncodePlugin } from '../src/index.js';

function makeFakeCompiler(): webpack.Compiler {
  return {
    options: { mode: 'production' },
    hooks: {
      thisCompilation: new SyncHook(['compilation']),
    },
    webpack,
  } as unknown as webpack.Compiler;
}

function makeFakeCompilation(): webpack.Compilation {
  return {
    warnings: [],
    errors: [],
    chunks: [],
    outputOptions: {},
    hooks: {
      processAssets: { tap: () => void 0 },
    },
    deleteAsset: () => void 0,
  } as unknown as webpack.Compilation;
}

describe('WebEncodePlugin: lepusCode-undefined safety (FetchBundle)', () => {
  // Force the JSON template path; the binary encoder requires more
  // structure than these synthetic encodeOptions provide.
  const originalBinary = process.env['EXPERIMENTAL_USE_WEB_BINARY_TEMPLATE'];
  void beforeEach(() => {
    process.env['EXPERIMENTAL_USE_WEB_BINARY_TEMPLATE'] = 'false';
  });
  void afterEach(() => {
    if (originalBinary === undefined) {
      delete process.env['EXPERIMENTAL_USE_WEB_BINARY_TEMPLATE'];
    } else {
      process.env['EXPERIMENTAL_USE_WEB_BINARY_TEMPLATE'] = originalBinary;
    }
  });

  test('encode hook handles encodeOptions.lepusCode === undefined without crashing', async () => {
    const compiler = makeFakeCompiler();
    const compilation = makeFakeCompilation();
    new WebEncodePlugin().apply(compiler);
    compiler.hooks.thisCompilation.call(compilation, {} as never);

    const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(compilation);

    // Mirror the FetchBundle shape: lepusCode is moved into customSections,
    // so the EncodeOptions.lepusCode slot is undefined.
    const result = await hooks.encode.promise({
      encodeOptions: {
        manifest: { '/main.js': 'console.log(1)' },
        compilerOptions: {},
        lepusCode: undefined,
        customSections: {
          'main-thread': { content: '/* mts */' },
          'background': { content: '/* bts */' },
          'CSS': { encoding: 'CSS', content: { ruleList: [] } },
        },
        css: { cssMap: {} },
        cardType: 'react',
        appType: 'app',
        pageConfig: {},
      } as never,
    });

    expect(result).toBeDefined();
    expect(Buffer.isBuffer(result?.buffer)).toBe(true);
    // The emitted JSON should at minimum carry an empty lepusCode object,
    // not crash on the undefined access we used to do.
    const json = JSON.parse(result.buffer.toString()) as Record<
      string,
      unknown
    >;
    expect(json['lepusCode']).toEqual({});
    expect(json['customSections']).toBeDefined();
  });

  test('legacy lepusCode-set path keeps the flattened shape', async () => {
    const compiler = makeFakeCompiler();
    const compilation = makeFakeCompilation();
    new WebEncodePlugin().apply(compiler);
    compiler.hooks.thisCompilation.call(compilation, {} as never);

    const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(compilation);

    const result = await hooks.encode.promise({
      encodeOptions: {
        manifest: { '/main.js': 'console.log(1)' },
        compilerOptions: {},
        lepusCode: {
          root: 'main lepus source',
          lepusChunk: { worklet: 'worklet src' },
        },
        customSections: {},
        css: { cssMap: {} },
        cardType: 'react',
        appType: 'app',
        pageConfig: {},
      } as never,
    });

    const json = JSON.parse(result.buffer.toString()) as Record<
      string,
      unknown
    >;
    expect(json['lepusCode']).toEqual({
      worklet: 'worklet src',
      root: 'main lepus source',
    });
  });
});
