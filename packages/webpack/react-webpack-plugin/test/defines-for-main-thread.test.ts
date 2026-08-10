// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { mkdtempSync } from 'node:fs';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { rspack } from '@rspack/core';
import { describe, expect, it } from '@rstest/core';

import {
  DEFINES_FOR_MAIN_THREAD_BUILD_INFO,
  collectDefinesForMainThread,
  renderDefinesForMainThread,
  renderDefinesForMainThreadModule,
  selectMissingDefinesForMainThread,
} from '../src/DefinesForMainThread.js';
import type { MainThreadDefine } from '../src/DefinesForMainThread.js';
import { LAYERS, ReactWebpackPlugin } from '../src/index.js';

function snapshot(id: string, code = `/* ${id} */`): MainThreadDefine {
  return { kind: 'snapshot', id, code };
}

interface TestModule {
  id: string;
  defines?: MainThreadDefine[];
  modules?: TestModule[];
}

function collect(modules: TestModule[]): MainThreadDefine[] {
  return collectDefinesForMainThread(modules, (module) => module.id);
}

function asModule(module: TestModule): TestModule {
  return {
    ...module,
    ...(module.defines === undefined ? {} : {
      buildInfo: { [DEFINES_FOR_MAIN_THREAD_BUILD_INFO]: module.defines },
    }),
    ...(module.modules
      ? { modules: module.modules.map((nested) => asModule(nested)) }
      : {}),
  } as TestModule;
}

describe('collectDefinesForMainThread', () => {
  it('collects the definitions in module order', () => {
    const defines = collect([
      asModule({ id: 'a', defines: [snapshot('A')] }),
      asModule({ id: 'b' }),
      asModule({ id: 'c', defines: [snapshot('C')] }),
    ]);

    expect(defines.map(({ id }) => id)).toEqual(['A', 'C']);
  });

  it('collects a module only once', () => {
    const shared = asModule({ id: 'shared', defines: [snapshot('S')] });
    const defines = collect([
      shared,
      shared,
      asModule({ id: 'other', defines: [snapshot('O')] }),
    ]);

    expect(defines.map(({ id }) => id)).toEqual(['S', 'O']);
  });

  it('registers a definition reached through several modules once', () => {
    const defines = collect([
      asModule({ id: 'a', defines: [snapshot('shared'), snapshot('a')] }),
      asModule({ id: 'b', defines: [snapshot('shared')] }),
    ]);

    expect(defines.map(({ id }) => id)).toEqual(['shared', 'a']);
  });

  it('fails the build when an id no longer identifies its content', () => {
    expect(() =>
      collect([
        asModule({ id: 'a', defines: [snapshot('x', 'one')] }),
        asModule({ id: 'b', defines: [snapshot('x', 'another')] }),
      ])
    ).toThrowError(/share the id x/);
  });

  it('keeps definitions of different kinds that share an id', () => {
    const defines = collect([
      asModule({
        id: 'a',
        defines: [snapshot('x'), { kind: 'worklet', id: 'x', code: 'w' }],
      }),
    ]);

    expect(defines).toHaveLength(2);
  });

  it('collects nothing when no module has definitions', () => {
    expect(collect([asModule({ id: 'a' })])).toEqual([]);
  });

  it('collects the definitions of concatenated inner modules', () => {
    const defines = collect([
      asModule({
        id: 'concatenated',
        defines: [snapshot('OUTER')],
        modules: [{ id: 'inner', defines: [snapshot('INNER')] }],
      }),
    ]);

    expect(defines.map(({ id }) => id)).toEqual(['OUTER', 'INNER']);
  });
});

describe('selectMissingDefinesForMainThread', () => {
  it('keeps only the definitions the main thread lacks', () => {
    const missing = selectMissingDefinesForMainThread(
      [snapshot('a'), snapshot('b')],
      [snapshot('b'), snapshot('c')],
    );

    expect(missing.map(({ id }) => id)).toEqual(['a']);
  });

  it('does not let a worklet id satisfy a snapshot id', () => {
    const missing = selectMissingDefinesForMainThread(
      [snapshot('x')],
      [{ kind: 'worklet', id: 'x', code: 'w' }],
    );

    expect(missing.map(({ id }) => id)).toEqual(['x']);
  });
});

describe('renderDefinesForMainThreadModule', () => {
  it('references the runtime through namespace member accesses', () => {
    const code = renderDefinesForMainThreadModule([
      snapshot('a', 'ReactLynx.createSnapshot(ReactLynx.__pageId);'),
    ]);

    expect(code).toContain(
      'import * as ReactLynx from \'@lynx-js/react/internal\';',
    );
    expect(code).toContain('ReactLynx.createSnapshot(ReactLynx.__pageId);');
    expect(code).not.toContain('var require');
    expect(code).not.toContain('loadWorkletRuntime');
  });

  it('binds the worklet runtime loader only for definitions that call it', () => {
    const code = renderDefinesForMainThreadModule([
      { kind: 'worklet', id: 'w', code: 'loadWorkletRuntime();' },
    ]);

    expect(code).toContain(
      'var loadWorkletRuntime = ReactLynx.loadWorkletRuntime;',
    );
  });

  it('emits the `require` fallback only for definitions that call it', () => {
    const code = renderDefinesForMainThreadModule([
      snapshot('a', 'require("@lynx-js/react/internal").createSnapshot;'),
    ]);

    expect(code).toContain('var require = function () { return ReactLynx; };');
  });
});

describe('renderDefinesForMainThread', () => {
  it('gives each definition its own block scope', () => {
    const code = renderDefinesForMainThread([
      { kind: 'worklet', id: 'a', code: 'const __workletRuntimeLoaded = 1;' },
      { kind: 'worklet', id: 'b', code: 'const __workletRuntimeLoaded = 1;' },
    ]);

    expect(code.match(/\{\nconst __workletRuntimeLoaded/g)).toHaveLength(2);
  });

  it('reaches for no bundler internal', () => {
    expect(renderDefinesForMainThread([])).not.toContain('__webpack_require__');
  });
});

describe('missing definitions injection', () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const require = createRequire(import.meta.url);

  function compile(
    definesByResource: Record<string, MainThreadDefine[]>,
    entries: Record<string, { import: string; layer: string }>,
    entryPairs: Array<{ mainThread: string; background: string }>,
  ) {
    const compiler = rspack({
      context: __dirname,
      mode: 'none',
      entry: entries,
      experiments: { layers: true },
      output: {
        path: mkdtempSync(path.join(tmpdir(), 'defines-for-main-thread-')),
        filename: '[name].js',
      },
      plugins: [
        new ReactWebpackPlugin({
          mainThreadChunks: entryPairs.map(({ mainThread }) =>
            `${mainThread}.js`
          ),
          entryPairs,
          workletRuntimePath: require.resolve(
            '@lynx-js/react/worklet-dev-runtime',
          ),
        }),
        (compiler: import('@rspack/core').Compiler) => {
          compiler.hooks.thisCompilation.tap('test', (compilation) => {
            compilation.hooks.succeedModule.tap('test', (module) => {
              if (module.layer !== LAYERS.BACKGROUND) {
                return;
              }
              for (
                const [resource, defines] of Object.entries(definesByResource)
              ) {
                if (module.identifier().includes(resource)) {
                  module.buildInfo![DEFINES_FOR_MAIN_THREAD_BUILD_INFO] =
                    defines;
                }
              }
            });
          });
        },
      ],
    });
    return new Promise<string>((resolve, reject) => {
      compiler.run((err, stats) => {
        if (err || stats?.hasErrors()) {
          reject(err ?? new Error(stats!.toString()));
          return;
        }
        resolve(compiler.options.output.path!);
      });
    });
  }

  it('renders the background definitions into the main-thread chunk', async () => {
    const outputPath = await compile(
      { 'empty.js': [snapshot('bg-only', 'registerBackgroundOnly;')] },
      {
        'main__main-thread': {
          import: './fixtures/empty.js',
          layer: LAYERS.MAIN_THREAD,
        },
        main: { import: './fixtures/empty.js', layer: LAYERS.BACKGROUND },
      },
      [{ mainThread: 'main__main-thread', background: 'main' }],
    );
    const content = await fs.readFile(
      path.join(outputPath, 'main__main-thread.js'),
      'utf-8',
    );

    expect(content).toContain('registerBackgroundOnly;');
  });

  it('renders nothing when the background has no extra definitions', async () => {
    const outputPath = await compile(
      {},
      {
        'main__main-thread': {
          import: './fixtures/empty.js',
          layer: LAYERS.MAIN_THREAD,
        },
        main: { import: './fixtures/empty.js', layer: LAYERS.BACKGROUND },
      },
      [{ mainThread: 'main__main-thread', background: 'main' }],
    );
    const content = await fs.readFile(
      path.join(outputPath, 'main__main-thread.js'),
      'utf-8',
    );

    expect(content).not.toContain('ReactLynx');
  });

  it('keeps the definitions of each entry apart', async () => {
    const outputPath = await compile(
      {
        'empty.js': [snapshot('a-only', 'registerEntryA;')],
        'empty2.js': [snapshot('b-only', 'registerEntryB;')],
      },
      {
        'a__main-thread': {
          import: './fixtures/empty.js',
          layer: LAYERS.MAIN_THREAD,
        },
        a: { import: './fixtures/empty.js', layer: LAYERS.BACKGROUND },
        'b__main-thread': {
          import: './fixtures/empty2.js',
          layer: LAYERS.MAIN_THREAD,
        },
        b: { import: './fixtures/empty2.js', layer: LAYERS.BACKGROUND },
      },
      [
        { mainThread: 'a__main-thread', background: 'a' },
        { mainThread: 'b__main-thread', background: 'b' },
      ],
    );

    const a = await fs.readFile(
      path.join(outputPath, 'a__main-thread.js'),
      'utf-8',
    );
    const b = await fs.readFile(
      path.join(outputPath, 'b__main-thread.js'),
      'utf-8',
    );

    expect(a).toContain('registerEntryA;');
    expect(a).not.toContain('registerEntryB;');
    expect(b).toContain('registerEntryB;');
    expect(b).not.toContain('registerEntryA;');
  });
});
