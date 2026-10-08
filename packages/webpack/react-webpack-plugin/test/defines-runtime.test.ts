// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import type { Context } from 'node:vm';

import { rspack } from '@rspack/core';
import type { Compiler, Stats } from '@rspack/core';
import { expect, it } from '@rstest/core';

import { ChunkLoadingWebpackPlugin } from '@lynx-js/chunk-loading-webpack-plugin';
import { LAYERS } from '@lynx-js/react-webpack-plugin';

import type { ReactCompileResult } from '../src/ReactWebpackPlugin.js';

const require = createRequire(import.meta.url);
const compileResultKey = Symbol.for(
  '@lynx-js/react/internal:compilation-result',
);
const workletSource = `export const handler = () => {
  'main thread';
  return 'injected-worklet';
};`;
const legacyWorkletSource = '/* __legacy_worklet_fixture */';
const plainSource = `export function handler() { return 'background-only'; }`;

interface Artifact {
  async: boolean;
  source: string;
  chunks: string[];
  filename: string;
  legacyRuntime: string | undefined;
}

interface BuildResult {
  compileResult: ReactCompileResult | undefined;
  artifacts: Artifact[];
  workletIds: string[];
}

async function createFixture(
  lazy: boolean,
  { legacy = false, separateEntry = false } = {},
) {
  // Share module instances with the loader files, including compiler-scoped
  // boundary imports and the template plugin's instanceof checks.
  const { ReactWebpackPlugin } = await import(
    pathToFileURL(require.resolve('@lynx-js/react-webpack-plugin')).href
  ) as typeof import('@lynx-js/react-webpack-plugin');
  const { LynxEncodePlugin, LynxTemplatePlugin } = await import(
    pathToFileURL(path.join(
      path.dirname(
        require.resolve('@lynx-js/template-webpack-plugin/package.json'),
      ),
      'lib/index.js',
    )).href
  ) as typeof import('@lynx-js/template-webpack-plugin');
  const tempRoot = path.resolve(__dirname, '../../../../.tmp/defines-runtime');
  await fs.mkdir(tempRoot, { recursive: true });
  const context = await fs.mkdtemp(path.join(tempRoot, 'fixture-'));
  const workletPath = path.join(context, 'worklet.js');
  const lazyEntry = `export const load = () => import('./boundary.js');`;
  await Promise.all([
    fs.writeFile(
      path.join(context, 'main.js'),
      lazy ? lazyEntry : 'export const ready = true;',
    ),
    fs.writeFile(
      path.join(context, 'background.js'),
      lazy ? lazyEntry : `export { handler } from './worklet.js';`,
    ),
    fs.writeFile(
      path.join(context, 'boundary.js'),
      `import { handler } from './worklet.js';
export const onTap = __MAIN_THREAD__ ? null : handler;`,
    ),
    fs.writeFile(workletPath, legacy ? legacyWorkletSource : workletSource),
    fs.writeFile(
      path.join(context, 'modern.js'),
      workletSource.replace(
        'injected-worklet',
        'modern-worklet',
      ),
    ),
  ]);

  let artifacts: Artifact[] = [];
  const compiler = rspack({
    context,
    mode: 'production',
    devtool: false,
    entry: {
      'main__main-thread': { import: './main.js', layer: LAYERS.MAIN_THREAD },
      main__background: { import: './background.js', layer: LAYERS.BACKGROUND },
      ...(separateEntry
        ? { modern: { import: './modern.js', layer: LAYERS.MAIN_THREAD } }
        : {}),
    },
    resolve: {
      modules: [path.resolve(__dirname, '../node_modules'), 'node_modules'],
    },
    output: {
      path: path.join(context, 'dist'),
      filename: '[name].js',
      publicPath: '',
      chunkFormat: 'commonjs',
      chunkLoading: 'lynx',
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          loader: 'builtin:swc-loader',
          options: { jsc: { target: 'es2019' } },
        },
        ...(['MAIN_THREAD', 'BACKGROUND'] as const).map(layer => ({
          test: /\.js$/,
          issuerLayer: LAYERS[layer],
          loader: ReactWebpackPlugin.loaders[layer],
          options: {
            transformPath: require.resolve(
              './fixtures/mixed-main-thread-transform.cjs',
            ),
          },
        })),
      ],
    },
    plugins: [
      new ChunkLoadingWebpackPlugin(),
      new ReactWebpackPlugin({
        mainThreadChunks: [
          'main__main-thread.js',
          ...(separateEntry ? ['modern.js'] : []),
        ],
        entryPairs: [{
          mainThread: 'main__main-thread',
          background: 'main__background',
        }],
        workletRuntimePath: require.resolve('@lynx-js/react/worklet-runtime'),
      }),
      new LynxEncodePlugin(),
      new LynxTemplatePlugin({
        ...LynxTemplatePlugin.defaultOptions,
        chunks: ['main__main-thread', 'main__background'],
        filename: 'template.js',
      }),
      ...(separateEntry
        ? [
          new LynxTemplatePlugin({
            ...LynxTemplatePlugin.defaultOptions,
            chunks: ['modern'],
            filename: 'modern/template.js',
            intermediate: '.lynx/modern',
          }),
        ]
        : []),
      {
        apply(compiler: Compiler) {
          compiler.hooks.thisCompilation.tap(
            'capture-defines-runtime',
            compilation => {
              artifacts = [];
              LynxTemplatePlugin.getLynxTemplatePluginHooks(compilation)
                .beforeEncode.tap('capture-defines-runtime', args => {
                  artifacts.push({
                    filename: args.filenameTemplate,
                    legacyRuntime: args.encodeData.lepusCode.chunks.find(
                      chunk => chunk.name === 'worklet-runtime',
                    )?.source.source().toString(),
                    async: args.chunkGroups.every(group => !group.isInitial()),
                    source: args.encodeData.lepusCode.root!.source.source()
                      .toString(),
                    chunks: args.encodeData.lepusCode.chunks.map(chunk =>
                      chunk.name
                    ),
                  });
                  return args;
                });
            },
          );
        },
      },
    ],
  });

  return {
    compiler,
    workletPath,
    backgroundPath: path.join(context, 'background.js'),
    result(stats: Stats): BuildResult {
      if (stats.hasErrors()) {
        throw new Error(
          stats.toString({ all: false, errors: true, errorDetails: true }),
        );
      }
      return {
        compileResult: (stats.compilation as unknown as Record<
          symbol,
          ReactCompileResult | undefined
        >)[
          compileResultKey
        ],
        artifacts,
        workletIds: [...stats.compilation.modules].flatMap(module => {
          if (module.layer !== LAYERS.BACKGROUND) {
            return [];
          }
          const defines = module.buildInfo?.['lynx:defines-for-worklet'] as
            | { id: string }[]
            | undefined;
          return defines?.map(define => define.id) ?? [];
        }),
      };
    },
    async dispose() {
      try {
        await new Promise<void>((resolve, reject) =>
          compiler.close(error => error ? reject(error) : resolve())
        );
      } finally {
        await fs.rm(context, { recursive: true, force: true });
      }
    },
  };
}

function run(compiler: Compiler): Promise<Stats> {
  return new Promise((resolve, reject) => {
    compiler.run((error, stats) => error ? reject(error) : resolve(stats!));
  });
}

function execute(
  artifacts: Artifact[],
  inspect?: (context: Context, lazy: boolean) => void,
) {
  const noop = () => undefined;
  let activeArtifact: Artifact;
  const host = {
    console,
    lynx: {
      getJSContext: () => ({ addEventListener: noop, dispatchEvent: noop }),
      setTimeout: noop,
      setInterval: noop,
      clearTimeout: noop,
      clearInterval: noop,
      requestAnimationFrame: noop,
      cancelAnimationFrame: noop,
    },
    SystemInfo: { lynxSdkVersion: '2.16' },
    __DEV__: false,
    __LEPUS__: true,
    __MAIN_THREAD__: true,
    __JS__: false,
    __OnLifecycleEvent: noop,
    __LoadLepusChunk(name: string) {
      expect(name).toBe('worklet-runtime');
      expect(activeArtifact.legacyRuntime).toBeDefined();
      runInContext(activeArtifact.legacyRuntime!, context);
      return true;
    },
    lynxWorkletImpl: undefined as undefined | {
      _workletMap: Record<string, () => string>;
    },
    processEvalResult: undefined as
      | undefined
      | ((factory: unknown, schema: string) => unknown),
  };
  const context = createContext(host);
  const entry = artifacts.filter(artifact => !artifact.async);
  expect(entry).toHaveLength(1);
  activeArtifact = entry[0]!;
  runInContext(activeArtifact.source, context);
  inspect?.(context, false);
  for (const artifact of artifacts.filter(artifact => artifact.async)) {
    activeArtifact = artifact;
    const factory: unknown = runInContext(artifact.source, context);
    host.processEvalResult!(factory, 'lazy-worklet');
    inspect?.(context, true);
  }
  return host.lynxWorkletImpl?._workletMap ?? {};
}

function expectRuntime(result: BuildResult, required: boolean, lazy: boolean) {
  expect(result.compileResult).toEqual({
    version: 1,
    runtimeRequirements: { mainThreadProgrammability: required },
  });
  expect(result.artifacts.filter(artifact => artifact.async)).toHaveLength(
    lazy ? 1 : 0,
  );
  expect(result.artifacts.flatMap(artifact => artifact.chunks)).not.toContain(
    'worklet-runtime',
  );
  const worklets = execute(result.artifacts);
  expect(Object.keys(worklets)).toHaveLength(required ? 1 : 0);
  if (required) {
    expect(Object.keys(worklets).sort()).toEqual(result.workletIds.sort());
    expect(worklets[result.workletIds[0]!]!()).toBe('injected-worklet');
  }
}

it('boots a background-only worklet through the paired main entry', async () => {
  const fixture = await createFixture(false);
  try {
    expectRuntime(fixture.result(await run(fixture.compiler)), true, false);
  } finally {
    await fixture.dispose();
  }
});

it.each([false, true])(
  'keeps legacy initialization local to its artifact with a separate modern entry: %s',
  async (separateEntry) => {
    const fixture = await createFixture(false, { legacy: true, separateEntry });
    try {
      const result = fixture.result(await run(fixture.compiler));
      expect(result.compileResult).toBeUndefined();
      const legacy = result.artifacts.filter(artifact =>
        artifact.filename === 'template.js'
      );
      expect(legacy).toHaveLength(1);
      expect(legacy[0]!.chunks).toContain('worklet-runtime');
      expect(execute(legacy)['legacy-transform:1']!()).toBe('injected-worklet');
      if (separateEntry) {
        const modern = result.artifacts.filter(artifact =>
          artifact.filename === 'modern/template.js'
        );
        expect(modern).toHaveLength(1);
        expect(modern[0]!.chunks).not.toContain('worklet-runtime');
        expect(Object.values(execute(modern)).map(worklet => worklet()))
          .toEqual(['modern-worklet']);
      }
    } finally {
      await fixture.dispose();
    }
  },
);

it.each([false, true])(
  'loads a legacy worklet before a later modern module, without treating plain legacy code as a worklet (legacy worklet: %s)',
  async (hasLegacyWorklet) => {
    const fixture = await createFixture(false, { legacy: true });
    try {
      if (!hasLegacyWorklet) {
        await fs.writeFile(fixture.workletPath, '/* __legacy_plain_fixture */');
      }
      await fs.writeFile(
        path.join(path.dirname(fixture.workletPath), 'main.js'),
        `
import './worklet.js';
import './modern.js';
export const ready = true;
`,
      );
      const result = fixture.result(await run(fixture.compiler));
      expect(result.compileResult).toEqual(
        hasLegacyWorklet ? undefined : {
          version: 1,
          runtimeRequirements: { mainThreadProgrammability: true },
        },
      );
      expect(result.artifacts[0]!.chunks.includes('worklet-runtime')).toBe(
        hasLegacyWorklet,
      );
      expect(
        Object.values(execute(result.artifacts)).map(worklet => worklet())
          .sort(),
      ).toEqual(
        hasLegacyWorklet
          ? ['injected-worklet', 'modern-worklet']
          : ['modern-worklet'],
      );
    } finally {
      await fixture.dispose();
    }
  },
);

it('preserves a cold-start MainThreadObject across lazy initialization', async () => {
  const fixture = await createFixture(true);
  try {
    await fs.writeFile(
      path.join(path.dirname(fixture.backgroundPath), 'main.js'),
      `
import { defineMainThreadObjectType } from '@lynx-js/react';
defineMainThreadObjectType({
  type: '@test/source-init',
  create(initialValue) {
    'main thread';
    return { get() { return initialValue; } };
  },
});
globalThis.testHandle = { _wvid: 1, _initValue: 42, _type: '@test/source-init' };
globalThis.readValue = value => {
  'main thread';
  return value.get();
};
export const load = () => import('./boundary.js');
`,
    );
    const result = fixture.result(await run(fixture.compiler));
    expect(result.artifacts.filter(artifact => artifact.async)).toHaveLength(1);
    expect(result.artifacts.flatMap(artifact => artifact.chunks)).not.toContain(
      'worklet-runtime',
    );
    let target: unknown;
    let runtime: unknown;
    execute(result.artifacts, (context, lazy) => {
      if (!lazy) {
        runtime = runInContext('lynxWorkletImpl', context);
        runInContext(
          `
          const { _wvid, _initValue, _type } = testHandle;
          lynxWorkletImpl._refImpl.updateWorkletRefInitValueChanges([[_wvid, _initValue, _type]]);
          globalThis.firstTarget = lynxWorkletImpl._refImpl._workletRefMap[_wvid];
        `,
          context,
        );
        target = runInContext('firstTarget', context);
        expect(target).toBeDefined();
      }
      expect(runInContext('lynxWorkletImpl', context)).toBe(runtime);
      expect(
        runInContext(
          'lynxWorkletImpl._refImpl._workletRefMap[testHandle._wvid]',
          context,
        ),
      ).toBe(target);
      expect(runInContext('runWorklet(readValue, [testHandle])', context)).toBe(
        42,
      );
      // A second typed patch must still find both the type and target metadata.
      runInContext(
        `lynxWorkletImpl._refImpl.updateWorkletRefInitValueChanges([
        [testHandle._wvid, 42, '@test/source-init'],
        [7, 57, '@test/source-init'],
      ])`,
        context,
      );
      expect(
        runInContext(
          'lynxWorkletImpl._refImpl._workletRefMap[7].get()',
          context,
        ),
      ).toBe(57);
    });
  } finally {
    await fixture.dispose();
  }
});

it.each([false, true])(
  'removes injected async worklets and their requirements on a watch rebuild (legacy: %s)',
  async (legacy) => {
    const fixture = await createFixture(true, { legacy });
    try {
      await new Promise<void>((resolve, reject) => {
        let builds = 0;
        const timeout = setTimeout(
          () => reject(new Error('Watch rebuild did not complete')),
          15_000,
        );
        fixture.compiler.watch({ aggregateTimeout: 25 }, (error, stats) => {
          if (error) {
            clearTimeout(timeout);
            reject(error);
            return;
          }
          try {
            const result = fixture.result(stats!);
            if (legacy && builds % 2 === 0) {
              expect(result.compileResult).toBeUndefined();
              expect(
                result.artifacts.find(artifact => !artifact.async)!.chunks,
              ).not.toContain('worklet-runtime');
              expect(
                result.artifacts.find(artifact => artifact.async)!.chunks,
              ).toContain('worklet-runtime');
              expect(execute(result.artifacts)['legacy-transform:1']!()).toBe(
                'injected-worklet',
              );
            } else {
              expectRuntime(
                result,
                legacy ? builds === 1 : builds % 2 === 0,
                true,
              );
            }
          } catch (error) {
            clearTimeout(timeout);
            reject(error as Error);
            return;
          }
          const next = [
            [fixture.workletPath, legacy ? workletSource : plainSource],
            [fixture.workletPath, legacy ? legacyWorkletSource : workletSource],
            [fixture.backgroundPath, 'export const ready = true;'],
          ][builds++];
          if (next) {
            void fs.writeFile(next[0]!, next[1]!).catch((error: Error) => {
              clearTimeout(timeout);
              reject(error);
            });
          } else {
            clearTimeout(timeout);
            resolve();
          }
        });
      });
    } finally {
      await fixture.dispose();
    }
  },
);
