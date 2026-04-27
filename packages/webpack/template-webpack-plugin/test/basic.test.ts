// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { TraceMap, generatedPositionFor } from '@jridgewell/trace-mapping';
import type { SourceMapInput } from '@jridgewell/trace-mapping';
import { SyncHook } from '@rspack/lite-tapable';
import { describe, expect, test } from '@rstest/core';
import webpack from 'webpack';
import type { Asset, WebpackError } from 'webpack';

import { CssExtractWebpackPlugin } from '../../css-extract-webpack-plugin/lib/index.js';
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
      entry: './fixtures/basic.tsx',
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

  test('emits css diagnostics during beforeEmit with current css chunk source maps', async () => {
    const context = dirname(new URL(import.meta.url).pathname);
    const compiler = {
      context,
      options: {
        mode: 'production',
      },
      hooks: {
        thisCompilation: new SyncHook(['compilation']),
      },
      webpack,
    } as unknown as webpack.Compiler;
    const compilation = {
      warnings: [],
      errors: [],
      chunks: [],
      outputOptions: {},
      hooks: {
        processAssets: {
          tap: () => void 0,
        },
      },
      deleteAsset: () => void 0,
    } as unknown as webpack.Compilation;
    const compilationParams = {} as Parameters<
      typeof compiler.hooks.thisCompilation.call
    >[1];

    new LynxEncodePlugin().apply(compiler);
    compiler.hooks.thisCompilation.call(compilation, compilationParams);

    const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(compilation);

    expect(compilation.warnings).toEqual([]);

    await hooks.beforeEmit.promise({
      finalEncodeOptions: {
        manifest: {},
        compilerOptions: {},
        lepusCode: {
          root: undefined,
          lepusChunk: {},
          filename: undefined,
        },
        customSections: {},
      },
      debugInfo: '',
      cssDiagnostics:
        '[{"type":"property","name":"unknown-prop","line":2,"column":10}]',
      template: Buffer.from(''),
      outputName: 'main.bundle',
      mainThreadAssets: [],
      cssChunks: [{
        name: 'main.css',
        info: {},
        source: {
          map: () => ({
            version: 3,
            file: '.rspeedy/second/second.css',
            sources: ['webpack:/basic.test.ts'],
            sourcesContent: [
              '.foo {\n  unknown-prop: red;\n}\n',
            ],
            names: [],
            mappings: 'AAAA;EACE,kBAAkB;AACpB',
          }),
        },
      } as never],
      entryNames: ['main'],
    });

    expect(compilation.warnings).toHaveLength(1);
    expect(compilation.warnings[0]?.message).toBe(
      'Unsupported property "unknown-prop" was removed during template encode.',
    );
    expect((compilation.warnings[0] as WebpackError)?.file).toBe(
      `${context}/basic.test.ts`,
    );
    expect((compilation.warnings[0] as WebpackError)?.loc).toEqual({
      start: {
        line: 2,
        column: 3,
      },
    });
  });

  test('maps css diagnostics to the matching source map for each entry', async () => {
    const context = join(
      dirname(new URL(import.meta.url).pathname),
      'fixtures',
      'css-diagnostics-mpa',
    );
    const outputPath = join(context, 'dist');
    const stats = await runWebpack({
      context,
      mode: 'development',
      devtool: 'source-map',
      target: 'node',
      entry: {
        a: './a.js',
        b: './b.js',
      },
      output: {
        filename: '[name]/[name].js',
        iife: false,
        publicPath: '/',
        path: outputPath,
      },
      module: {
        rules: [
          {
            test: /\.css$/,
            use: [
              CssExtractWebpackPlugin.loader,
              {
                loader: 'css-loader',
                options: {
                  sourceMap: true,
                },
              },
            ],
          },
        ],
      },
      plugins: [
        new CssExtractWebpackPlugin({
          filename: '[name]/[name].css',
        }),
        new LynxEncodePlugin(),
      ],
    });

    expect(stats.compilation.errors).toEqual([]);
    expect(stats.compilation.warnings).toEqual([]);

    const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(
      stats.compilation,
    );
    const aCssAsset = createCSSAsset(
      'a/a.css',
      JSON.parse(await readFile(join(outputPath, 'a/a.css.map'), 'utf-8')),
    );
    const bCssAsset = createCSSAsset(
      'b/b.css',
      JSON.parse(await readFile(join(outputPath, 'b/b.css.map'), 'utf-8')),
    );
    const aSourceMap = aCssAsset.source.map?.();
    const bSourceMap = bCssAsset.source.map?.();

    expect(aSourceMap).toBeDefined();
    expect(Array.isArray(aSourceMap)).toBe(false);
    expect(bSourceMap).toBeDefined();
    expect(Array.isArray(bSourceMap)).toBe(false);

    if (!aSourceMap || Array.isArray(aSourceMap)) {
      throw new Error('Missing source map for a/a.css');
    }
    if (!bSourceMap || Array.isArray(bSourceMap)) {
      throw new Error('Missing source map for b/b.css');
    }

    const aSource = aSourceMap.sources.find(source => source.endsWith('a.css'));
    const bSource = bSourceMap.sources.find(source => source.endsWith('b.css'));

    expect(aSource).toBeDefined();
    expect(bSource).toBeDefined();

    if (!aSource) {
      throw new Error('Missing source a.css in a/a.css');
    }
    if (!bSource) {
      throw new Error('Missing source b.css in b/b.css');
    }

    const aGenerated = generatedPositionFor(
      new TraceMap(aSourceMap as SourceMapInput),
      {
        source: aSource,
        line: 2,
        column: 2,
      },
    );
    const bGenerated = generatedPositionFor(
      new TraceMap(bSourceMap as SourceMapInput),
      {
        source: bSource,
        line: 2,
        column: 2,
      },
    );

    expect(aGenerated.line).not.toBeNull();
    expect(aGenerated.column).not.toBeNull();
    expect(bGenerated.line).not.toBeNull();
    expect(bGenerated.column).not.toBeNull();

    if (aGenerated.line === null || aGenerated.column === null) {
      throw new Error('Missing generated position for a/a.css');
    }
    if (bGenerated.line === null || bGenerated.column === null) {
      throw new Error('Missing generated position for b/b.css');
    }

    await hooks.beforeEmit.promise({
      ...createBeforeEmitArgs('a/template.js'),
      cssDiagnostics: createCSSDiagnosticsJSON({
        type: 'property',
        name: 'unknown-a',
        line: aGenerated.line,
        column: aGenerated.column + 1,
      }),
      cssChunks: [aCssAsset],
      entryNames: ['a'],
    });
    await hooks.beforeEmit.promise({
      ...createBeforeEmitArgs('b/template.js'),
      cssDiagnostics: createCSSDiagnosticsJSON({
        type: 'property',
        name: 'unknown-b',
        line: bGenerated.line,
        column: bGenerated.column + 1,
      }),
      cssChunks: [bCssAsset],
      entryNames: ['b'],
    });

    expect(
      stats.compilation.warnings.map((warning) => ({
        message: warning.message,
        file: (warning as WebpackError).file,
      })),
    ).toEqual([
      {
        message:
          'Unsupported property "unknown-a" was removed during template encode.',
        file: `${context}/a.css`,
      },
      {
        message:
          'Unsupported property "unknown-b" was removed during template encode.',
        file: `${context}/b.css`,
      },
    ]);
    expect(stats.compilation.warnings.map((warning) => warning.message))
      .toEqual([
        'Unsupported property "unknown-a" was removed during template encode.',
        'Unsupported property "unknown-b" was removed during template encode.',
      ]);
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

function createBeforeEmitArgs(outputName: string) {
  return {
    finalEncodeOptions: {
      manifest: {},
      compilerOptions: {},
      lepusCode: {
        root: undefined,
        lepusChunk: {},
        filename: undefined,
      },
      customSections: {},
    },
    debugInfo: '',
    template: Buffer.from(''),
    outputName,
    mainThreadAssets: [],
  };
}

function createCSSAsset(name: string, sourceMap: unknown): Asset {
  return {
    name,
    info: {},
    source: {
      map: () => sourceMap,
    },
  } as never;
}

function createCSSDiagnosticsJSON(diagnostic: {
  type: string;
  name: string;
  line: number;
  column: number;
}): string {
  return `[{"type":"${diagnostic.type}","name":"${diagnostic.name}","line":${diagnostic.line},"column":${diagnostic.column}}]`;
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
    expect(errors.map(error => error?.message)).toMatchInlineSnapshot(`
      [
        module3 cannot be loaded,
        module3 cannot be loaded,
      ]
    `);
  });
});
