// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it } from '@rstest/core';

import {
  islandModuleWrapper,
  rootIslandWrapper,
} from '../src/MainThreadIslands.js';
import {
  MTS_DEFINES_BUILD_INFO,
  collectMTSDefines,
} from '../src/MTSDefinesRuntimeModule.js';
import type { MTSDefine } from '../src/MTSDefinesRuntimeModule.js';

function decode(wrapper: string): string {
  expect(wrapper.startsWith('data:text/javascript,')).toBe(true);
  return decodeURIComponent(wrapper.slice('data:text/javascript,'.length));
}

describe('islandModuleWrapper', () => {
  it('imports the whole namespace so the exports survive tree shaking', () => {
    const source = decode(islandModuleWrapper('/abs/Shell.tsx'));

    expect(source).toContain('import * as ns from "/abs/Shell.tsx";');
    // Storing the namespace is what makes the import load-bearing: nothing
    // else in the main-thread layer references the module.
    expect(source).toContain('Symbol.for("__REACT_LYNX_MTS_ISLANDS__")');
    expect(source).toContain('.set("/abs/Shell.tsx", ns);');
  });

  it('stays free of syntax no loader will lower', () => {
    // A `data:` URI matches no module rule, so the wrapper reaches the main
    // thread exactly as written — no arrow functions, no `let`/`const`.
    const source = decode(islandModuleWrapper('/abs/Shell.tsx'));

    expect(source).not.toMatch(/=>/);
    expect(source).not.toMatch(/\b(let|const)\b/);
  });
});

describe('rootIslandWrapper', () => {
  it('registers a named export as the first frame', () => {
    const source = decode(rootIslandWrapper('/abs/Shell.tsx', 'Shell'));

    expect(source).toContain(
      'import { Shell as island } from "/abs/Shell.tsx";',
    );
    expect(source).toContain(
      'globalThis[Symbol.for("__REACT_LYNX_MTS_ROOT_ISLAND__")] = island;',
    );
  });

  it('registers a default export as the first frame', () => {
    const source = decode(rootIslandWrapper('/abs/Shell.tsx', 'default'));

    expect(source).toContain('import island from "/abs/Shell.tsx";');
  });
});

interface TestModule {
  id: string;
  resource?: string;
  defines?: MTSDefine[];
  modules?: TestModule[];
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

function snapshot(id: string): MTSDefine {
  return { kind: 'snapshot', id, code: `/* ${id} */` };
}

describe('collectMTSDefines with islands', () => {
  const chunks = [{
    modules: [
      asModule({
        id: 'a',
        resource: '/abs/Shell.tsx',
        defines: [snapshot('A')],
      }),
      asModule({
        id: 'b',
        resource: '/abs/Feed.tsx',
        defines: [snapshot('B')],
      }),
    ],
  }];

  const collect = (onMainThread: ReadonlySet<string>) =>
    collectMTSDefines<{ modules: TestModule[] }, TestModule>(
      chunks,
      (chunk) => chunk.modules,
      (module) => module.id,
      (module) => onMainThread.has(module.resource!),
    );

  it('skips the definitions of a module compiled on the main thread', () => {
    // The island registers its own definitions when its module runs, so
    // assembling them again would register every snapshot twice.
    expect(collect(new Set(['/abs/Shell.tsx'])).map(({ id }) => id))
      .toEqual(['B']);
  });

  it('keeps every definition when nothing is compiled on the main thread', () => {
    expect(collect(new Set()).map(({ id }) => id)).toEqual(['A', 'B']);
  });

  it('still rejects two different definitions sharing an id', () => {
    expect(() =>
      collectMTSDefines<{ modules: TestModule[] }, TestModule>(
        [{
          modules: [
            asModule({
              id: 'a',
              defines: [{ kind: 'snapshot', id: 'X', code: '1' }],
            }),
            asModule({
              id: 'b',
              defines: [{ kind: 'snapshot', id: 'X', code: '2' }],
            }),
          ],
        }],
        (chunk) => chunk.modules,
        (module) => module.id,
      )
    ).toThrow(/share the id X/);
  });
});
