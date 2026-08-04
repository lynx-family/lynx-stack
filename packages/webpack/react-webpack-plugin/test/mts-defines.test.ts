// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it } from '@rstest/core';

import {
  MTS_DEFINES_BUILD_INFO,
  collectMTSDefines,
  renderLazyMTSDefines,
  renderMTSDefines,
} from '../src/MTSDefinesRuntimeModule.js';
import type { MTSDefine } from '../src/MTSDefinesRuntimeModule.js';

function snapshot(id: string, code = `/* ${id} */`): MTSDefine {
  return { kind: 'snapshot', id, code };
}

interface TestModule {
  id: string;
  defines?: MTSDefine[];
  modules?: TestModule[];
}

interface TestChunk {
  modules: TestModule[];
}

function collect(chunks: TestChunk[]): MTSDefine[] {
  return collectMTSDefines<TestChunk, TestModule>(
    chunks,
    (chunk) => chunk.modules,
    (module) => module.id,
  );
}

function asModule(module: TestModule): TestModule {
  return {
    ...module,
    ...(module.defines === undefined ? {} : {
      buildInfo: { [MTS_DEFINES_BUILD_INFO]: module.defines },
    }),
    ...(module.modules
      ? { modules: module.modules.map((nested) => asModule(nested)) }
      : {}),
  } as TestModule;
}

describe('collectMTSDefines', () => {
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

describe('renderMTSDefines', () => {
  it('gives each definition its own block scope', () => {
    const code = renderMTSDefines([
      { kind: 'worklet', id: 'a', code: 'const __workletRuntimeLoaded = 1;' },
      { kind: 'worklet', id: 'b', code: 'const __workletRuntimeLoaded = 1;' },
    ]);

    expect(code).toContain('var __initMTSDefines = function (');
    expect(code.match(/\{\nconst __workletRuntimeLoaded/g)).toHaveLength(2);
  });

  it('reaches for no bundler internal', () => {
    expect(renderMTSDefines([])).not.toContain('__webpack_require__');
  });

  it('publishes the runtime for a lazy bundle section to read', () => {
    expect(renderMTSDefines([])).toContain(
      'globalThis[Symbol.for(\'__REACT_LYNX_MTS_DEFINES_RUNTIME__\')] = ReactLynx;',
    );
  });
});

describe('renderLazyMTSDefines', () => {
  const code = renderLazyMTSDefines(
    [snapshot('a', 'ReactLynx.createSnapshot(globDynamicComponentEntry);')],
    'lynx:lazy/main-thread.js',
  );

  it('evaluates to a section the host installs as a chunk', () => {
    expect(code).toMatch(/^\(function \(globDynamicComponentEntry\) \{/);
    expect(code).toContain('ids: ["lynx:lazy/main-thread.js"]');
    expect(code).toContain('function (module, exports, __webpack_require__)');
  });

  it('reuses the host runtime instead of bundling its own', () => {
    expect(code).toContain(
      'globalThis[Symbol.for(\'__REACT_LYNX_MTS_DEFINES_RUNTIME__\')]',
    );
  });

  it('keeps the lazy bundle entry name, so its CSS scope is applied', () => {
    expect(code).toContain(
      'ReactLynx.createSnapshot(globDynamicComponentEntry)',
    );
  });
});

describe('subtracting what the main thread owns', () => {
  const owned = (...keys: string[]) => new Set(keys);

  const collectWithOwned = (
    chunks: TestChunk[],
    ownedKeys: Set<string>,
  ): MTSDefine[] =>
    collectMTSDefines<TestChunk, TestModule>(
      chunks,
      (chunk) => chunk.modules,
      (module) => module.id,
      ownedKeys,
    );

  it('drops a definition the main-thread bundle already carries', () => {
    const defines = collectWithOwned([{
      modules: [
        asModule({
          id: 'a',
          defines: [snapshot('island'), snapshot('deferred')],
        }),
      ],
    }], owned('snapshot:island'));

    expect(defines.map(({ id }) => id)).toEqual(['deferred']);
  });

  it('still fails the build on id drift the main thread happens to own', () => {
    // The drift alarm answers "do two background modules disagree on what
    // this id means", which has nothing to do with who else emits it.
    expect(() =>
      collectWithOwned([{
        modules: [
          asModule({ id: 'a', defines: [snapshot('x', 'one')] }),
          asModule({ id: 'b', defines: [snapshot('x', 'another')] }),
        ],
      }], owned('snapshot:x'))
    ).toThrowError(/share the id x/);
  });

  it('subtracts by kind as well as id', () => {
    const defines = collectWithOwned([{
      modules: [
        asModule({
          id: 'a',
          defines: [snapshot('x'), { kind: 'worklet', id: 'x', code: 'w' }],
        }),
      ],
    }], owned('snapshot:x'));

    expect(defines.map(({ kind }) => kind)).toEqual(['worklet']);
  });

  it('collects everything when the main thread owns nothing', () => {
    const defines = collectWithOwned([{
      modules: [asModule({ id: 'a', defines: [snapshot('A'), snapshot('B')] })],
    }], owned());

    expect(defines.map(({ id }) => id)).toEqual(['A', 'B']);
  });
});
