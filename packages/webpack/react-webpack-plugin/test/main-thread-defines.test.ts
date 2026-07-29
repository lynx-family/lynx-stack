// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it } from '@rstest/core';

import {
  MAIN_THREAD_DEFINES_BUILD_INFO,
  collectMainThreadDefines,
  renderLazyMainThreadDefines,
  renderMainThreadDefines,
  usesLazyBundle,
} from '../src/MainThreadDefinesRuntimeModule.js';
import type { MainThreadDefine } from '../src/MainThreadDefinesRuntimeModule.js';

function snapshot(id: string, code = `/* ${id} */`): MainThreadDefine {
  return { kind: 'snapshot', id, code };
}

interface TestModule {
  id: string;
  defines?: MainThreadDefine[];
  modules?: TestModule[];
}

interface TestChunk {
  modules: TestModule[];
}

function collect(chunks: TestChunk[]): MainThreadDefine[] {
  return collectMainThreadDefines<TestChunk, TestModule>(
    chunks,
    (chunk) => chunk.modules,
    (module) => module.id,
  );
}

function asModule(module: TestModule): TestModule {
  return {
    ...module,
    ...(module.defines === undefined ? {} : {
      buildInfo: { [MAIN_THREAD_DEFINES_BUILD_INFO]: module.defines },
    }),
    ...(module.modules
      ? { modules: module.modules.map((nested) => asModule(nested)) }
      : {}),
  } as TestModule;
}

describe('collectMainThreadDefines', () => {
  it('collects the definitions of a chunk in module order', () => {
    const defines = collect([{
      modules: [
        asModule({ id: 'a', defines: [snapshot('A')] }),
        asModule({ id: 'b' }),
        asModule({ id: 'c', defines: [snapshot('C')] }),
      ],
    }]);

    expect(defines.map(({ id }) => id)).toEqual(['A', 'C']);
  });

  it('collects a module only once when it is in several chunks', () => {
    const shared = asModule({ id: 'shared', defines: [snapshot('S')] });
    const defines = collect([
      { modules: [shared] },
      {
        modules: [shared, asModule({ id: 'other', defines: [snapshot('O')] })],
      },
    ]);

    expect(defines.map(({ id }) => id)).toEqual(['S', 'O']);
  });

  it('registers a definition reached through several modules once', () => {
    const defines = collect([{
      modules: [
        asModule({ id: 'a', defines: [snapshot('shared'), snapshot('a')] }),
        asModule({ id: 'b', defines: [snapshot('shared')] }),
      ],
    }]);

    expect(defines.map(({ id }) => id)).toEqual(['shared', 'a']);
  });

  it('fails the build when an id no longer identifies its content', () => {
    expect(() =>
      collect([{
        modules: [
          asModule({ id: 'a', defines: [snapshot('x', 'one')] }),
          asModule({ id: 'b', defines: [snapshot('x', 'another')] }),
        ],
      }])
    ).toThrowError(/share the id x/);
  });

  it('keeps definitions of different kinds that share an id', () => {
    const defines = collect([{
      modules: [
        asModule({
          id: 'a',
          defines: [snapshot('x'), { kind: 'worklet', id: 'x', code: 'w' }],
        }),
      ],
    }]);

    expect(defines).toHaveLength(2);
  });

  it('collects nothing when no module has definitions', () => {
    expect(collect([{ modules: [asModule({ id: 'a' })] }])).toEqual([]);
  });

  it('collects the definitions of concatenated inner modules', () => {
    const defines = collect([{
      modules: [
        asModule({
          id: 'concatenated',
          defines: [snapshot('OUTER')],
          modules: [{ id: 'inner', defines: [snapshot('INNER')] }],
        }),
      ],
    }]);

    expect(defines.map(({ id }) => id)).toEqual(['OUTER', 'INNER']);
  });
});

describe('renderMainThreadDefines', () => {
  it('gives each definition its own block scope', () => {
    const code = renderMainThreadDefines([
      { kind: 'worklet', id: 'a', code: 'const __workletRuntimeLoaded = 1;' },
      { kind: 'worklet', id: 'b', code: 'const __workletRuntimeLoaded = 1;' },
    ]);

    // Two definitions declaring the same guard must not collide.
    expect(code).toContain('var __lynxMainThreadDefines = function (');
    expect(code.match(/\{\nconst __workletRuntimeLoaded/g)).toHaveLength(2);
  });

  it('reaches for no bundler internal', () => {
    expect(renderMainThreadDefines([])).not.toContain('__webpack_require__');
  });

  it('publishes the runtime only for a card that can host a lazy bundle', () => {
    expect(renderMainThreadDefines([], true)).toContain(
      'globalThis[Symbol.for(\'__REACT_LYNX_MAIN_THREAD_DEFINES_RUNTIME__\')] = ReactLynx;',
    );
    expect(renderMainThreadDefines([])).not.toContain(
      '__REACT_LYNX_MAIN_THREAD_DEFINES_RUNTIME__',
    );
  });

  it('fails the build when a definition needs an unprovided runtime member', () => {
    expect(() =>
      renderMainThreadDefines([
        snapshot('a', 'ReactLynx.createSnapshot(ReactLynx.__pageId);'),
        snapshot('b', 'ReactLynx.renderMainThread();'),
      ])
    ).toThrowError(/renderMainThread/);
  });

  it('accepts the runtime members the main-thread entry provides', () => {
    expect(() =>
      renderMainThreadDefines([
        snapshot(
          'a',
          'ReactLynx.snapshotCreatorMap[x] = () => ReactLynx.createSnapshot(ReactLynx.__pageId, ReactLynx.updateSpread, ReactLynx.__DynamicPartSlotV2);',
        ),
      ])
    ).not.toThrow();
  });
});

describe('renderLazyMainThreadDefines', () => {
  const code = renderLazyMainThreadDefines(
    [snapshot('a', 'ReactLynx.createSnapshot(globDynamicComponentEntry);')],
    'lynx:lazy/main-thread.js',
  );

  it('evaluates to a section the host installs as a chunk', () => {
    // The host card evaluates the section and installs the returned chunk into
    // its own main-thread runtime.
    expect(code).toMatch(/^\(function \(globDynamicComponentEntry\) \{/);
    expect(code).toContain('ids: ["lynx:lazy/main-thread.js"]');
    expect(code).toContain('function (module, exports, __webpack_require__)');
  });

  it('reuses the host runtime instead of bundling its own', () => {
    // The same channel `@lynx-js/react/experimental/lazy/import` uses, so the
    // handoff does not depend on the bundler.
    expect(code).toContain(
      'globalThis[Symbol.for(\'__REACT_LYNX_MAIN_THREAD_DEFINES_RUNTIME__\')]',
    );
  });

  it('keeps the lazy bundle entry name, so its CSS scope is applied', () => {
    // `globDynamicComponentEntry` is the section parameter, not the host's.
    expect(code).toContain(
      'ReactLynx.createSnapshot(globDynamicComponentEntry)',
    );
  });
});

interface FakeModule {
  id: string;
  modules?: { id: string }[];
}

function withModules(modules: FakeModule[], hasAsyncChunk = false): boolean {
  return usesLazyBundle(
    [modules],
    (chunk: FakeModule[]) =>
      chunk.map(module => ({
        identifier: () => module.id,
        modules: module.modules?.map(nested => ({
          identifier: () => nested.id,
        })),
      })),
    hasAsyncChunk,
  );
}

describe('usesLazyBundle', () => {
  const LAZY_IMPORT =
    'javascript/auto|/repo/packages/react/runtime/lazy/import.js|react:background';

  it('sees a lazy bundle built in the same compilation as an async chunk', () => {
    expect(withModules([], true)).toBe(true);
  });

  it('sees a lazy bundle built elsewhere through the injected lazy import', () => {
    expect(withModules([{ id: LAZY_IMPORT }])).toBe(true);
  });

  it('sees the injected lazy import inside a concatenated module', () => {
    expect(
      withModules([{ id: 'concatenated', modules: [{ id: LAZY_IMPORT }] }]),
    ).toBe(true);
  });

  it('reports none for a card that never loads one', () => {
    expect(
      withModules([
        { id: 'javascript/auto|/repo/packages/react/runtime/lib/internal.js' },
        { id: 'javascript/auto|/repo/src/index.tsx' },
      ]),
    ).toBe(false);
  });
});
