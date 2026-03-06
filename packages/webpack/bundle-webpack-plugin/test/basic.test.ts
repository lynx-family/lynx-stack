// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { dirname } from 'node:path';

import { describe, expect, test } from 'vitest';
import webpack from 'webpack';

import { LynxEncodePlugin, LynxTemplatePlugin } from '../src/index.js';
import { getRequireModuleAsyncCachePolyfill } from '../src/polyfill/requireModuleAsync.js';

describe('LynxTemplatePlugin', () => {
  test('build with custom lepus', async () => {
    const stats = await runWebpack({
      context: dirname(new URL(import.meta.url).pathname),
      mode: 'development',
      devtool: false,
      output: {
        iife: false,
      },
      entry: new URL('./fixtures/basic.tsx', import.meta.url).pathname,
      plugins: [
        function() {
          this.hooks.thisCompilation.tap('test', (compilation) => {
            compilation.emitAsset(
              'main.lepus',
              new this.webpack.sources.RawSource(`\
globalThis.renderPage = function() {
  var page = __CreatePage("0", 0);
  var pageId = __GetElementUniqueID(page);
  var el = __CreateView(pageId);
  __AppendElement(page, el);
  var el1 = __CreateText(pageId);
  __AppendElement(el, el1);
  var el2 = __CreateRawText("Hello Lynx x Webpack");
  __AppendElement(el1, el2);
}`),
              { entry: 'main' },
            );
          });
        },
        new LynxTemplatePlugin(),
        new LynxEncodePlugin(),
      ],
    });

    expect(stats.compilation.errors).toEqual([]);
    expect(stats.compilation.children.flatMap(i => i.errors)).toEqual([]);

    const { assets } = stats.toJson({ all: false, assets: true });
    expect(assets?.find(i => i.name === 'main.js')).not.toBeUndefined();
    expect(assets?.find(i => i.name === 'main.lepus')).not.toBeUndefined();
  });
});

function runWebpack(config: webpack.Configuration): Promise<webpack.Stats> {
  const compiler = webpack(config);

  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) {
        return reject(err);
      }

      if (!stats) {
        return reject(new Error('webpack return empty stats'));
      }

      resolve(stats);
      compiler.close(() => void 0);
    });
  });
}

describe('requireModuleAsyncCachePolyfill', () => {
  const moduleResult: Record<string, [Error | null, string]> = {
    'module1': [null, 'module1'],
    'module2': [null, 'module2'],
    'module3': [new Error('module3 cannot be loaded'), 'module3'],
  };
  const evalTimes: Record<string, number> = {};
  // A very simple implementation of lynx.requireModuleAsync
  // Just to check the polyfill works
  const lynx = {
    requireModuleAsync: function(
      moduleUrl: string,
      callback: (error: Error | null, value: string) => void,
    ) {
      if (lynx.requireModuleAsync.cache[moduleUrl]) {
        return callback?.(null, lynx.requireModuleAsync.cache[moduleUrl]);
      }

      // The script load will cost some time
      // Use setTimeout to simulate the script load
      setTimeout(() => {
        evalTimes[moduleUrl] = (evalTimes[moduleUrl] ?? 0) + 1;
        lynx.requireModuleAsync.cache[moduleUrl] = moduleUrl;
        if (callback) {
          callback(moduleResult[moduleUrl]![0], moduleResult[moduleUrl]![1]);
        }
      }, 0);
    },
  } as {
    requireModuleAsync:
      & ((
        moduleUrl: string,
        callback: (error: Error | null, value: string) => void,
      ) => void)
      & {
        cache: Record<string, string>;
      };
  };
  lynx.requireModuleAsync.cache = {};

  test('Parallel calls with the same moduleUrl will eval twice by default', async () => {
    // Two parallel calls with the same moduleUrl will eval twice by default
    lynx.requireModuleAsync('module1', (_error, _value) => void 0);
    lynx.requireModuleAsync('module1', (_error, _value) => void 0);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(evalTimes['module1']).toBe(2);
  });

  test('The polyfill should cache the result', async () => {
    const polyfill = getRequireModuleAsyncCachePolyfill();
    expect(polyfill).toContain('var moduleCache = {}');

    // Call the polyfill
    eval(polyfill);

    // Two parallel calls with the same moduleUrl will eval only once
    lynx.requireModuleAsync('module2', (_error, _value) => void 0);
    lynx.requireModuleAsync('module2', (_error, _value) => void 0);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(evalTimes['module2']).toBe(1);

    // error handling
    const errors: (Error | null)[] = [];
    lynx.requireModuleAsync('module3', (error, _value) => errors.push(error));
    lynx.requireModuleAsync('module3', (error, _value) => errors.push(error));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(evalTimes['module3']).toBe(1);
    expect(errors).toMatchInlineSnapshot(`
      [
        [Error: module3 cannot be loaded],
        [Error: module3 cannot be loaded],
      ]
    `);
  });
});
