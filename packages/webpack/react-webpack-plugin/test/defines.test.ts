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
  DEFINES_FOR_SNAPSHOT_BUILD_INFO,
  DEFINES_FOR_WORKLET_BUILD_INFO,
  collectDefines,
  renderDefines,
  renderDefinesModule,
  selectMissingDefines,
} from '../src/Defines.js';
import type { Define } from '../src/Defines.js';
import { LAYERS, ReactWebpackPlugin } from '../src/index.js';

function define(id: string, code = `/* ${id} */`): Define {
  return { id, code };
}

interface TestModule {
  id: string;
  defines?: Define[];
  modules?: TestModule[];
}

function collect(modules: TestModule[]): Define[] {
  return collectDefines(
    modules,
    DEFINES_FOR_SNAPSHOT_BUILD_INFO,
    (module) => module.id,
  );
}

function asModule(module: TestModule): TestModule {
  return {
    ...module,
    ...(module.defines === undefined ? {} : {
      buildInfo: { [DEFINES_FOR_SNAPSHOT_BUILD_INFO]: module.defines },
    }),
    ...(module.modules
      ? { modules: module.modules.map((nested) => asModule(nested)) }
      : {}),
  } as TestModule;
}

describe('collectDefines', () => {
  it('collects the definitions in module order', () => {
    const defines = collect([
      asModule({ id: 'a', defines: [define('A')] }),
      asModule({ id: 'b' }),
      asModule({ id: 'c', defines: [define('C')] }),
    ]);

    expect(defines.map(({ id }) => id)).toEqual(['A', 'C']);
  });

  it('collects a module only once', () => {
    const shared = asModule({ id: 'shared', defines: [define('S')] });
    const defines = collect([
      shared,
      shared,
      asModule({ id: 'other', defines: [define('O')] }),
    ]);

    expect(defines.map(({ id }) => id)).toEqual(['S', 'O']);
  });

  it('registers a definition reached through several modules once', () => {
    const defines = collect([
      asModule({ id: 'a', defines: [define('shared'), define('a')] }),
      asModule({ id: 'b', defines: [define('shared')] }),
    ]);

    expect(defines.map(({ id }) => id)).toEqual(['shared', 'a']);
  });

  it('fails the build when an id no longer identifies its content', () => {
    expect(() =>
      collect([
        asModule({ id: 'a', defines: [define('x', 'one')] }),
        asModule({ id: 'b', defines: [define('x', 'another')] }),
      ])
    ).toThrowError(/share the id x/);
  });

  it('reads only the requested kind', () => {
    const defines = collectDefines(
      [
        {
          id: 'a',
          buildInfo: {
            [DEFINES_FOR_SNAPSHOT_BUILD_INFO]: [define('snapshot-only')],
            [DEFINES_FOR_WORKLET_BUILD_INFO]: [define('worklet-only')],
          },
        },
      ],
      DEFINES_FOR_WORKLET_BUILD_INFO,
      (module) => module.id,
    );

    expect(defines.map(({ id }) => id)).toEqual(['worklet-only']);
  });

  it('collects nothing when no module has definitions', () => {
    expect(collect([asModule({ id: 'a' })])).toEqual([]);
  });

  it('collects the definitions of concatenated inner modules', () => {
    const defines = collect([
      asModule({
        id: 'concatenated',
        defines: [define('OUTER')],
        modules: [{ id: 'inner', defines: [define('INNER')] }],
      }),
    ]);

    expect(defines.map(({ id }) => id)).toEqual(['OUTER', 'INNER']);
  });
});

describe('selectMissingDefines', () => {
  it('keeps only the definitions the other side lacks', () => {
    const missing = selectMissingDefines(
      [define('a'), define('b')],
      [define('b'), define('c')],
    );

    expect(missing.map(({ id }) => id)).toEqual(['a']);
  });
});

describe('renderDefinesModule', () => {
  it('references the runtime through namespace member accesses', () => {
    const code = renderDefinesModule(
      [define('a', 'ReactLynx.createSnapshot(ReactLynx.__pageId);')],
      [],
    );

    expect(code).toContain(
      'import * as ReactLynx from \'@lynx-js/react/internal\';',
    );
    expect(code).toContain('ReactLynx.createSnapshot(ReactLynx.__pageId);');
    expect(code).not.toContain('var require');
    expect(code).not.toContain('loadWorkletRuntime');
  });

  it('binds the worklet runtime loader only for worklet definitions', () => {
    const code = renderDefinesModule([], [
      define('w', 'loadWorkletRuntime();'),
    ]);

    expect(code).toContain(
      'var loadWorkletRuntime = ReactLynx.loadWorkletRuntime;',
    );
  });

  it('emits the `require` fallback only for definitions that call it', () => {
    const code = renderDefinesModule(
      [define('a', 'require("@lynx-js/react/internal").createSnapshot;')],
      [],
    );

    expect(code).toContain('var require = function () { return ReactLynx; };');
  });
});

describe('renderDefines', () => {
  it('gives each definition its own block scope', () => {
    const code = renderDefines([
      define('a', 'const __workletRuntimeLoaded = 1;'),
      define('b', 'const __workletRuntimeLoaded = 1;'),
    ]);

    expect(code.match(/\{\nconst __workletRuntimeLoaded/g)).toHaveLength(2);
  });

  it('reaches for no bundler internal', () => {
    expect(renderDefines([])).not.toContain('__webpack_require__');
  });
});

describe('missing definitions injection', () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const require = createRequire(import.meta.url);

  function compile(
    definesByResource: Record<
      string,
      { snapshot?: Define[]; worklet?: Define[] }
    >,
    entries: Record<string, { import: string; layer: string }>,
    entryPairs: Array<{ mainThread: string; background: string }>,
    options?: { mainThreadDefines?: boolean },
  ) {
    const compiler = rspack({
      context: __dirname,
      mode: 'none',
      entry: entries,
      experiments: { layers: true },
      output: {
        path: mkdtempSync(path.join(tmpdir(), 'defines-')),
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
              if (
                module.layer !== LAYERS.BACKGROUND
                && !options?.mainThreadDefines
              ) {
                return;
              }
              for (
                const [resource, defines] of Object.entries(definesByResource)
              ) {
                if (module.identifier().includes(resource)) {
                  if (defines.snapshot) {
                    module
                      .buildInfo![DEFINES_FOR_SNAPSHOT_BUILD_INFO] =
                        defines.snapshot;
                  }
                  if (defines.worklet) {
                    module
                      .buildInfo![DEFINES_FOR_WORKLET_BUILD_INFO] =
                        defines.worklet;
                  }
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
      {
        'empty.js': {
          snapshot: [define('bg-only', 'registerBackgroundOnly;')],
          worklet: [define('bg-worklet', 'registerBackgroundWorklet;')],
        },
      },
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
    expect(content).toContain('registerBackgroundWorklet;');
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

  async function compileWithExports(imports: string[]): Promise<string> {
    const outputPath = mkdtempSync(
      path.join(tmpdir(), 'defines-exports-'),
    );
    const compiler = rspack({
      context: __dirname,
      mode: 'none',
      entry: {
        'main__main-thread': {
          import: imports,
          layer: LAYERS.MAIN_THREAD,
        },
        main: { import: './fixtures/empty.js', layer: LAYERS.BACKGROUND },
      },
      experiments: { layers: true },
      resolve: {
        alias: {
          '@lynx-js/react/internal': path.join(
            __dirname,
            'fixtures/internal-stub.js',
          ),
        },
      },
      output: {
        path: outputPath,
        filename: '[name].cjs',
        library: { type: 'commonjs2' },
      },
      plugins: [
        new ReactWebpackPlugin({
          mainThreadChunks: ['main__main-thread.cjs'],
          entryPairs: [{ mainThread: 'main__main-thread', background: 'main' }],
          workletRuntimePath: require.resolve(
            '@lynx-js/react/worklet-dev-runtime',
          ),
        }),
        (compiler: import('@rspack/core').Compiler) => {
          compiler.hooks.thisCompilation.tap('test', (compilation) => {
            compilation.hooks.succeedModule.tap('test', (module) => {
              if (
                module.layer === LAYERS.BACKGROUND
                && module.identifier().includes('empty.js')
              ) {
                module.buildInfo![DEFINES_FOR_SNAPSHOT_BUILD_INFO] = [
                  define(
                    'bg-only',
                    'globalThis.__definesRan = true;',
                  ),
                ];
              }
            });
          });
        },
      ],
    });
    await new Promise<void>((resolve, reject) => {
      compiler.run((err, stats) => {
        if (err || stats?.hasErrors()) {
          reject(err ?? new Error(stats!.toString()));
          return;
        }
        resolve();
      });
    });
    return path.join(outputPath, 'main__main-thread.cjs');
  }

  it('runs the definitions ahead of the entry without stealing its exports', async () => {
    delete (globalThis as Record<string, unknown>).__definesRan;
    const exported = require(
      await compileWithExports(['./fixtures/entry-exports.js']),
    ) as { marker?: string };

    expect(exported.marker).toBe('ENTRY_EXPORTS');
    expect((globalThis as Record<string, unknown>).__definesRan)
      .toBe(true);
    expect((globalThis as Record<string, unknown>).__entrySawDefines).toBe(
      true,
    );
  });

  it('runs the definitions ahead of every import of a multi-import entry', async () => {
    delete (globalThis as Record<string, unknown>).__definesRan;
    const exported = require(
      await compileWithExports([
        './fixtures/entry-bootstrap.js',
        './fixtures/entry-exports.js',
      ]),
    ) as { marker?: string; bootstrap?: boolean };

    expect(exported.marker).toBe('ENTRY_EXPORTS');
    expect(exported.bootstrap).toBeUndefined();
    expect((globalThis as Record<string, unknown>).__bootstrapSawDefines).toBe(
      true,
    );
    expect((globalThis as Record<string, unknown>).__entrySawDefines).toBe(
      true,
    );
  });

  it('fails the build when the main thread lacks an unmergeable worklet', async () => {
    await expect(compile(
      {
        'empty.js': {
          worklet: [{ id: 'shared-worklet', code: '', unmergeable: true }],
        },
      },
      {
        'main__main-thread': {
          import: './fixtures/empty2.js',
          layer: LAYERS.MAIN_THREAD,
        },
        main: { import: './fixtures/empty.js', layer: LAYERS.BACKGROUND },
      },
      [{ mainThread: 'main__main-thread', background: 'main' }],
    )).rejects.toThrowError(/cannot be merged/);
  });

  it('accepts an unmergeable worklet the main thread already has', async () => {
    const definesByResource = {
      'empty.js': {
        worklet: [{ id: 'shared-worklet', code: '', unmergeable: true }],
      },
    };
    const outputPath = await compile(
      definesByResource,
      {
        'main__main-thread': {
          import: './fixtures/empty.js',
          layer: LAYERS.MAIN_THREAD,
        },
        main: { import: './fixtures/empty.js', layer: LAYERS.BACKGROUND },
      },
      [{ mainThread: 'main__main-thread', background: 'main' }],
      { mainThreadDefines: true },
    );
    const content = await fs.readFile(
      path.join(outputPath, 'main__main-thread.js'),
      'utf-8',
    );

    expect(content).not.toContain('ReactLynx');
  });

  it('leaves the definitions of an async-only module out of the entry injection', async () => {
    const outputPath = await compile(
      {
        'empty2.js': { snapshot: [define('async-only', 'registerAsyncOnly;')] },
      },
      {
        'main__main-thread': {
          import: './fixtures/empty.js',
          layer: LAYERS.MAIN_THREAD,
        },
        main: {
          import: './fixtures/lazy-importer.js',
          layer: LAYERS.BACKGROUND,
        },
      },
      [{ mainThread: 'main__main-thread', background: 'main' }],
    );
    const content = await fs.readFile(
      path.join(outputPath, 'main__main-thread.js'),
      'utf-8',
    );

    expect(content).not.toContain('registerAsyncOnly;');
  });

  it('keeps the definitions of each entry apart', async () => {
    const outputPath = await compile(
      {
        'empty.js': { snapshot: [define('a-only', 'registerEntryA;')] },
        'empty2.js': { snapshot: [define('b-only', 'registerEntryB;')] },
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
