// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setImmediate } from 'node:timers/promises';
import { runInNewContext } from 'node:vm';

import { rspack } from '@rspack/core';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  rstest,
} from '@rstest/core';

import { ExternalsLoadingPlugin } from '../src/index.js';

async function compileWithExternals(
  externals: ConstructorParameters<
    typeof ExternalsLoadingPlugin
  >[0]['externals'],
  entryCode: string,
): Promise<
  { background: string; mainThread: string; cleanup: () => Promise<void> }
> {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'lynx-section-map-'),
  );
  const entryFile = path.join(directory, 'entry.js');
  await fs.writeFile(entryFile, entryCode, 'utf8');

  await new Promise<void>((resolve, reject) => {
    const compiler = rspack({
      mode: 'development',
      context: directory,
      entry: {
        'main-thread': { import: entryFile, layer: 'main-thread' },
        background: { import: entryFile, layer: 'background' },
      },
      output: { path: directory, filename: '[name].js', publicPath: '' },
      optimization: { concatenateModules: false },
      plugins: [
        new ExternalsLoadingPlugin({
          mainThreadLayer: 'main-thread',
          backgroundLayer: 'background',
          externals,
        }),
      ],
    });
    compiler.run((error, stats) => {
      compiler.close((closeError) => {
        if (error) reject(error);
        else if (closeError) reject(closeError);
        else if (stats?.hasErrors()) reject(new Error(stats.toString()));
        else resolve();
      });
    });
  });

  const [background, mainThread] = await Promise.all([
    fs.readFile(path.join(directory, 'background.js'), 'utf8'),
    fs.readFile(path.join(directory, 'main-thread.js'), 'utf8'),
  ]);

  return {
    background,
    mainThread,
    cleanup: () => fs.rm(directory, { recursive: true, force: true }),
  };
}

function sharedExternals(isAsync: boolean) {
  return {
    'lib-a': {
      libraryName: 'LibA',
      url: 'https://cdn.example/shared.lynx.bundle',
      async: isAsync,
      background: { sectionPath: 'LibA' },
      mainThread: { sectionPath: 'LibA__main-thread' },
    },
    'lib-b': {
      libraryName: 'LibB',
      url: 'https://cdn.example/shared.lynx.bundle',
      async: isAsync,
      background: { sectionPath: 'LibB' },
      mainThread: { sectionPath: 'LibB__main-thread' },
    },
  };
}

describe('__sectionMap resolution', () => {
  let syncBundle: Awaited<ReturnType<typeof compileWithExternals>>;
  let asyncBundle: Awaited<ReturnType<typeof compileWithExternals>>;

  beforeAll(async () => {
    const entryCode = `
      import a from 'lib-a';
      import b from 'lib-b';
      globalThis.__results = [a, b];
    `;

    [syncBundle, asyncBundle] = await Promise.all([
      compileWithExternals(sharedExternals(false), entryCode),
      compileWithExternals(sharedExternals(true), entryCode),
    ]);
  });

  afterAll(async () => {
    await Promise.all([syncBundle?.cleanup(), asyncBundle?.cleanup()]);
  });

  it('resolves hashed background section names via __sectionMap and caches lookup per bundle per card (sync)', () => {
    const getCustomSectionSync = rstest.fn(
      (key: string, bundleName: string) => {
        if (
          key === '__sectionMap'
          && bundleName === 'https://cdn.example/shared.lynx.bundle'
        ) {
          return {
            LibA: 'LibA.11111111',
            LibB: 'LibB.22222222',
          };
        }
        return undefined;
      },
    );
    const loadScript = rstest.fn((section: string) => ({
      loadedSection: section,
    }));

    const sandbox: Record<string, unknown> = {
      lynx: {
        fetchBundle: (url: string) => ({
          wait: () => ({ code: 0, url }),
        }),
        getCustomSectionSync,
        loadScript,
      },
    };

    runInNewContext(syncBundle.background, sandbox);

    expect(getCustomSectionSync).toHaveBeenCalledTimes(1);
    expect(getCustomSectionSync).toHaveBeenCalledWith(
      '__sectionMap',
      'https://cdn.example/shared.lynx.bundle',
    );
    expect(loadScript).toHaveBeenNthCalledWith(1, 'LibA.11111111', {
      bundleName: 'https://cdn.example/shared.lynx.bundle',
    });
    expect(loadScript).toHaveBeenNthCalledWith(2, 'LibB.22222222', {
      bundleName: 'https://cdn.example/shared.lynx.bundle',
    });
    expect(sandbox['__results']).toEqual([
      { loadedSection: 'LibA.11111111' },
      { loadedSection: 'LibB.22222222' },
    ]);
  });

  it('resolves hashed background section names via __sectionMap (async)', async () => {
    const getCustomSectionSync = rstest.fn(
      (key: string, bundleName: string) => {
        if (
          key === '__sectionMap'
          && bundleName === 'https://cdn.example/shared.lynx.bundle'
        ) {
          return {
            LibA: 'LibA.aaaaaaaa',
            LibB: 'LibB.bbbbbbbb',
          };
        }
        return undefined;
      },
    );
    const loadScript = rstest.fn((section: string) => ({
      loadedSection: section,
    }));

    const sandbox: Record<string, unknown> = {
      lynx: {
        fetchBundle: (url: string) => Promise.resolve({ code: 0, url }),
        getCustomSectionSync,
        loadScript,
      },
    };

    runInNewContext(asyncBundle.background, sandbox);
    await setImmediate();

    expect(getCustomSectionSync).toHaveBeenCalledTimes(1);
    expect(loadScript).toHaveBeenNthCalledWith(1, 'LibA.aaaaaaaa', {
      bundleName: 'https://cdn.example/shared.lynx.bundle',
    });
    expect(loadScript).toHaveBeenNthCalledWith(2, 'LibB.bbbbbbbb', {
      bundleName: 'https://cdn.example/shared.lynx.bundle',
    });
    expect(sandbox['__results']).toEqual([
      { loadedSection: 'LibA.aaaaaaaa' },
      { loadedSection: 'LibB.bbbbbbbb' },
    ]);
  });

  it('bypasses stale LynxGroup loadScript cache across cards when the same URL updates, and still hits cache when unchanged', () => {
    // Simulate BaseApp._$loadScriptCache shared across cards in a LynxGroup:
    // keyed strictly by bundleName + sectionPath.
    const sharedLoadScriptCache = new Map<string, unknown>();
    const nativeEval = rstest.fn(
      (sections: Record<string, unknown>, sectionPath: string) => {
        if (!(sectionPath in sections)) {
          throw new Error(`Missing section ${sectionPath}`);
        }
        return sections[sectionPath];
      },
    );

    const runCard = (bundle: {
      sectionMap: Record<string, string>;
      sections: Record<string, unknown>;
    }) => {
      const sandbox: Record<string, unknown> = {
        lynx: {
          fetchBundle: (url: string) => ({
            wait: () => ({ code: 0, url }),
          }),
          getCustomSectionSync: (key: string) =>
            key === '__sectionMap' ? bundle.sectionMap : undefined,
          loadScript: (
            sectionPath: string,
            { bundleName }: { bundleName: string },
          ) => {
            const cacheKey = bundleName + sectionPath;
            if (sharedLoadScriptCache.has(cacheKey)) {
              return sharedLoadScriptCache.get(cacheKey);
            }
            const exports = nativeEval(bundle.sections, sectionPath);
            sharedLoadScriptCache.set(cacheKey, exports);
            return exports;
          },
        },
      };
      runInNewContext(syncBundle.background, sandbox);
      return sandbox['__results'];
    };

    const bundleV1 = {
      sectionMap: { LibA: 'LibA.00000001', LibB: 'LibB.00000001' },
      sections: {
        'LibA.00000001': { version: '0.7.2', name: 'A' },
        'LibB.00000001': { version: '0.7.2', name: 'B' },
      },
    };
    const bundleV2 = {
      sectionMap: { LibA: 'LibA.00000002', LibB: 'LibB.00000002' },
      sections: {
        'LibA.00000002': { version: '0.7.6', name: 'A' },
        'LibB.00000002': { version: '0.7.6', name: 'B' },
      },
    };

    // Card 1 loads v1
    expect(runCard(bundleV1)).toEqual([
      { version: '0.7.2', name: 'A' },
      { version: '0.7.2', name: 'B' },
    ]);
    expect(nativeEval).toHaveBeenCalledTimes(2);

    // Card 2 loads hot-updated v2 at the same URL — must NOT hit stale v1 cache
    expect(runCard(bundleV2)).toEqual([
      { version: '0.7.6', name: 'A' },
      { version: '0.7.6', name: 'B' },
    ]);
    expect(nativeEval).toHaveBeenCalledTimes(4);

    // Card 3 loads unchanged v2 — must hit shared LynxGroup cache without re-evaluating
    expect(runCard(bundleV2)).toEqual([
      { version: '0.7.6', name: 'A' },
      { version: '0.7.6', name: 'B' },
    ]);
    expect(nativeEval).toHaveBeenCalledTimes(4);
  });

  it('falls back to original sectionPath when __sectionMap is missing or partial', () => {
    const loadScriptPartial = rstest.fn((section: string) => ({ section }));
    runInNewContext(syncBundle.background, {
      lynx: {
        fetchBundle: (url: string) => ({ wait: () => ({ code: 0, url }) }),
        getCustomSectionSync: () => ({ LibA: 'LibA.deadbeef' }),
        loadScript: loadScriptPartial,
      },
    });
    expect(loadScriptPartial).toHaveBeenNthCalledWith(1, 'LibA.deadbeef', {
      bundleName: 'https://cdn.example/shared.lynx.bundle',
    });
    expect(loadScriptPartial).toHaveBeenNthCalledWith(2, 'LibB', {
      bundleName: 'https://cdn.example/shared.lynx.bundle',
    });

    const loadScriptNoMap = rstest.fn((section: string) => ({ section }));
    const getCustomSectionSyncNull = rstest.fn(() => undefined);
    runInNewContext(syncBundle.background, {
      lynx: {
        fetchBundle: (url: string) => ({ wait: () => ({ code: 0, url }) }),
        getCustomSectionSync: getCustomSectionSyncNull,
        loadScript: loadScriptNoMap,
      },
    });
    expect(getCustomSectionSyncNull).toHaveBeenCalledTimes(1);
    expect(loadScriptNoMap).toHaveBeenNthCalledWith(1, 'LibA', {
      bundleName: 'https://cdn.example/shared.lynx.bundle',
    });
    expect(loadScriptNoMap).toHaveBeenNthCalledWith(2, 'LibB', {
      bundleName: 'https://cdn.example/shared.lynx.bundle',
    });
  });

  it('does not query __sectionMap on main-thread layer', () => {
    const getCustomSectionSync = rstest.fn(() => ({
      'LibA__main-thread': 'LibA__main-thread.11111111',
    }));
    const loadScript = rstest.fn((section: string) => ({ section }));
    const loadStyleSheet = rstest.fn(() => null);

    runInNewContext(syncBundle.mainThread, {
      lynx: {
        fetchBundle: (url: string) => ({ wait: () => ({ code: 0, url }) }),
        getCustomSectionSync,
        loadScript,
      },
      __LoadStyleSheet: loadStyleSheet,
    });

    expect(getCustomSectionSync).not.toHaveBeenCalled();
    expect(loadScript).toHaveBeenNthCalledWith(1, 'LibA__main-thread', {
      bundleName: 'https://cdn.example/shared.lynx.bundle',
    });
    expect(loadStyleSheet).toHaveBeenNthCalledWith(
      1,
      'LibA:CSS',
      'https://cdn.example/shared.lynx.bundle',
    );
  });
});
