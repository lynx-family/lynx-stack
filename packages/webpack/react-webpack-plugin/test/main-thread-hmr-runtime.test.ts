// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// VM globals and evaluated factories are intentionally dynamic test boundaries.
/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */

import { createContext, runInContext } from 'node:vm';

import { expect, it, rs } from '@rstest/core';

import { RuntimeGlobals } from '@lynx-js/webpack-runtime-globals';

import backgroundRuntime from '../src/runtime/hmr-background.js';
import loadRuntime from '../src/runtime/hmr-load.js';
import mainThreadRuntime from '../src/runtime/hmr-main-thread.js';

function runtimeSource(
  runtime: () => void,
  entryModules: string[] = [],
): string {
  return [loadRuntime, runtime].map(fn => `(${fn.toString()})();`).join('\n')
    .replaceAll('$BACKGROUND$', JSON.stringify(runtime === backgroundRuntime))
    .replaceAll('$RuntimeGlobals_lynxHMR$', RuntimeGlobals.lynxHMR)
    .replaceAll('$RuntimeGlobals_lynxHMRLoad$', RuntimeGlobals.lynxHMRLoad)
    .replaceAll('$METHOD$', '"applyUpdate"')
    .replaceAll('$EVENT$', '"ready"')
    .replaceAll('$HOT_MODULE$', '"entry"')
    .replaceAll('$ENTRY_MODULES$', JSON.stringify(entryModules));
}

const handler = () => undefined;

it.each(['fetchBundle', 'loadScript', 'both'])(
  'reports an unsupported MTS host missing %s without applying an update',
  async missing => {
    const acknowledgments: Record<string, unknown>[] = [];
    let applications = 0;
    const context = createContext({
      Promise,
      __webpack_require__: {
        i: [],
        h: () => 'old',
        c: {
          entry: {
            hot: {
              check: () => {
                applications++;
              },
            },
          },
        },
      },
      lynx: {
        fetchBundle: missing === 'loadScript' ? handler : undefined,
        loadScript: missing === 'fetchBundle' ? handler : undefined,
        getJSContext: () => ({
          dispatchEvent: (event: { data: string }) =>
            acknowledgments.push(JSON.parse(event.data)),
        }),
      },
    });
    runInContext(runtimeSource(mainThreadRuntime), context);
    context['applyUpdate']({ session: 'page', sequence: 1, hash: 'wrong' });
    expect(acknowledgments[0]).toMatchObject({ ok: false, hash: 'old' });
    expect(acknowledgments[0]).not.toHaveProperty('supported', false);
    context['applyUpdate']({ session: 'page', sequence: 2, hash: 'old' });
    await expect.poll(() => acknowledgments.length).toBe(2);
    expect(acknowledgments[1]).toMatchObject({
      session: 'page',
      sequence: 2,
      hash: 'old',
      ok: false,
      supported: false,
    });
    expect(applications).toBe(0);
  },
);

it.each(['default', 'accepted', 'declined', 'throwing', 'dependency'])(
  'preserves %s entry behavior when installing the root fallback',
  behavior => {
    const interceptors: ((
      options: {
        id: string;
        factory: () => void;
        module: { hot: typeof hot };
      },
    ) => void)[] = [];
    const hot = {
      _selfAccepted: false as boolean | (() => void),
      _selfDeclined: false,
      accept: () => {
        hot._selfAccepted = true;
      },
    };
    const context = createContext({
      lynx: {},
      __webpack_require__: { i: interceptors },
    });
    runInContext(runtimeSource(mainThreadRuntime, ['entry']), context);
    const options = {
      id: behavior === 'dependency' ? 'helper' : 'entry',
      module: { hot },
      factory: () => {
        if (behavior === 'accepted') hot._selfAccepted = handler;
        if (behavior === 'declined') hot._selfDeclined = true;
        if (behavior === 'throwing') throw new Error('entry failure');
      },
    };
    interceptors[0]!(options);
    if (behavior === 'throwing') {
      expect(() => options.factory()).toThrow('entry failure');
    } else options.factory();
    expect(hot._selfAccepted).toBe(
      behavior === 'default'
        ? true
        : (behavior === 'accepted' ? handler : false),
    );
    expect(hot._selfDeclined).toBe(behavior === 'declined');
  },
);

it.each([mainThreadRuntime, backgroundRuntime])(
  'loads versioned Native sections on either thread without reusing the previous bundle',
  async runtime => {
    const fetched: string[] = [];
    const loaded: string[] = [];
    const context = createContext({
      Promise,
      __webpack_require__: {
        i: [],
        p: 'http://localhost/',
        c: {},
        h: () => 'old',
      },
      lynx: {
        fetchBundle: (url: string) => ({
          then: (resolve: (value: unknown) => void) => {
            fetched.push(url);
            resolve({ code: 0, url });
            return null;
          },
        }),
        getCoreContext: () => ({ addEventListener: () => undefined }),
        loadScript: (
          section: string,
          { bundleName }: { bundleName: string },
        ) => {
          loaded.push(bundleName + ':' + section);
          return section === 'manifest'
            ? { c: ['a', 'b'] }
            : { ids: [section[0]], version: bundleName };
        },
      },
    });
    runInContext(runtimeSource(runtime), context);
    const load = (name: string) =>
      new Promise((resolve, reject) => {
        context['__webpack_require__'].lynxHMRLoad(
          `http://localhost/${name}`,
          (error: Error, value: unknown) => {
            if (error) reject(error);
            else resolve(value);
          },
        );
      });

    expect(await load('main.old.hot-update.json')).toEqual({ c: ['a', 'b'] });
    expect(await load('a.old.js')).toEqual({ ids: ['a'], version: fetched[0] });
    expect(await load('b.old.js')).toEqual({ ids: ['b'], version: fetched[0] });
    expect(await load('main.new.hot-update.json')).toEqual({ c: ['a', 'b'] });
    expect(await load('a.new.js')).toEqual({ ids: ['a'], version: fetched[1] });
    expect(fetched).toEqual([
      'http://localhost/main.old.hot-update.bundle',
      'http://localhost/main.new.hot-update.bundle',
    ]);
    expect(loaded).toEqual([
      `${fetched[0]}:manifest`,
      `${fetched[0]}:a.old.js`,
      `${fetched[0]}:b.old.js`,
      `${fetched[1]}:manifest`,
      `${fetched[1]}:a.new.js`,
    ]);
  },
);

it.each(['promise', 'thenable', 'throw'])(
  'reports a Native bundle load failure from %s without waiting for the coordinator timeout',
  async mode => {
    const failure = new Error('Native bundle unavailable');
    let received: Error | undefined;
    let loaded = 0;
    const context = createContext({
      Promise,
      __webpack_require__: { i: [], p: '/', c: {}, h: () => 'old' },
      lynx: {
        fetchBundle: () => {
          if (mode === 'throw') throw failure;
          if (mode === 'promise') return Promise.reject(failure);
          return {
            then: (
              _resolve: (value: unknown) => void,
              reject?: (error: Error) => void,
            ) => {
              reject?.(failure);
              return null;
            },
          };
        },
        loadScript: () => {
          loaded++;
        },
      },
    });
    runInContext(runtimeSource(mainThreadRuntime), context);
    context['__webpack_require__'].lynxHMRLoad(
      '/main.old.hot-update.json',
      (error: Error) => {
        received = error;
      },
    );
    await expect.poll(() => received, { timeout: 500 }).toBe(failure);
    expect(loaded).toBe(0);
  },
);

it('reports a mismatched MTS version without applying and acknowledges the actual new hash after success', async () => {
  const acknowledgments: { sequence: number; hash: string; ok: boolean }[] = [];
  let hash = 'old';
  let applications = 0;
  const context = createContext({
    Promise,
    __webpack_require__: {
      i: [],
      p: '/',
      h: () => hash,
      c: {
        entry: {
          hot: {
            check: () => {
              applications++;
              hash = 'new';
              return Promise.resolve([]);
            },
          },
        },
      },
    },
    lynx: {
      fetchBundle: handler,
      loadScript: handler,
      getJSContext: () => ({
        dispatchEvent: (event: { data: string }) => {
          acknowledgments.push(JSON.parse(event.data));
        },
      }),
    },
  });
  runInContext(runtimeSource(mainThreadRuntime), context);
  context['applyUpdate']({ sequence: 1, hash: 'wrong' });
  expect(applications).toBe(0);
  expect(acknowledgments[0]).toMatchObject({
    sequence: 1,
    hash: 'old',
    ok: false,
  });
  context['applyUpdate']({ sequence: 2, hash: 'old' });
  await expect.poll(() => acknowledgments.length).toBe(2);
  expect(acknowledgments[1]).toMatchObject({
    sequence: 2,
    hash: 'new',
    ok: true,
  });
  expect(applications).toBe(1);
});

function createBackground(native = false) {
  const requests: { session: string; sequence: number; hash: string }[] = [];
  let listener: (event: { data: string }) => void;
  let cleared = 0;
  const context = createContext({
    Promise,
    setTimeout: () => 1,
    clearTimeout: () => {
      cleared++;
    },
    __webpack_require__: { i: [] },
    lynx: {
      fetchBundle: native ? handler : undefined,
      loadScript: native ? handler : undefined,
      getCoreContext: () => ({
        addEventListener: (_name: string, callback: typeof listener) => {
          listener = callback;
        },
      }),
      getNativeApp: () => ({
        callLepusMethod: (_name: string, request: typeof requests[number]) => {
          requests.push(request);
        },
      }),
    },
  });
  runInContext(runtimeSource(backgroundRuntime), context);
  return {
    context,
    coordinator: context['__webpack_require__'].lynxHMR,
    requests,
    acknowledge: (ack: Record<string, unknown>) =>
      listener({
        data: JSON.stringify({ session: requests[0]!.session, ...ack }),
      }),
    cleared: () => cleared,
  };
}

it('waits for a matching ACK and detects a factory exception even when an accept handler consumes it', async () => {
  const background = createBackground();
  const ready = background.coordinator.prepare('old');
  let released = false;
  ready.then(() => {
    released = true;
  });
  background.acknowledge({ sequence: 0, ok: true, hash: 'wrong' });
  background.acknowledge({
    session: 'old-page',
    sequence: 1,
    ok: true,
    hash: 'wrong',
  });
  await Promise.resolve();
  expect(released).toBe(false);
  background.acknowledge({ sequence: 1, ok: true, hash: 'new' });
  await ready;
  expect(background.cleared()).toBe(1);

  runInContext(
    `
    var options={factory:function(){throw new Error('factory failed');}};
    __webpack_require__.i[0](options);
    try { options.factory(); } catch(error) { globalThis.acceptedError=error; }
  `,
    background.context,
  );
  expect(() => background.coordinator.finish('new')).toThrow('factory failed');
  background.coordinator.stop();
  background.acknowledge({ sequence: 2, ok: true, hash: 'late' });
  await expect(background.coordinator.prepare('new')).rejects.toThrow(
    'transaction stopped',
  );
  expect(background.requests).toHaveLength(1);
});

it('fails a missing MTS completion at ten seconds and ignores a late ACK', async () => {
  rs.useFakeTimers();
  try {
    const background = createBackground();
    background.context['setTimeout'] = setTimeout;
    background.context['clearTimeout'] = clearTimeout;
    const ready = background.coordinator.prepare('old');
    let settled = false;
    ready.then(() => {
      settled = true;
    }, () => {
      settled = true;
    });
    const failure = expect(ready).rejects.toThrow('completion timed out');
    await rs.advanceTimersByTimeAsync(9999);
    expect(settled).toBe(false);
    await rs.advanceTimersByTimeAsync(1);
    await failure;
    background.coordinator.stop();
    background.acknowledge({ sequence: 1, ok: true, hash: 'late' });
    await expect(background.coordinator.prepare('old')).rejects.toThrow(
      'transaction stopped',
    );
  } finally {
    rs.useRealTimers();
  }
});

it('removes the BTS coordinator only after a matched unsupported-host ACK', async () => {
  const background = createBackground(true);
  expect(background.context['__webpack_require__'].lynxHMRLoad).toBeTypeOf(
    'function',
  );
  const ready = background.coordinator.prepare('old');
  let released = false;
  ready.then(() => {
    released = true;
  });
  background.acknowledge({
    session: 'old-page',
    sequence: 1,
    ok: false,
    supported: false,
  });
  background.acknowledge({ sequence: 0, ok: false, supported: false });
  await Promise.resolve();
  expect(released).toBe(false);
  expect(background.context['__webpack_require__'].lynxHMR).toBe(
    background.coordinator,
  );
  background.acknowledge({ sequence: 1, ok: false, supported: false });
  await expect(ready).resolves.toBe(false);
  expect(background.cleared()).toBe(1);
  expect(background.context['__webpack_require__'].lynxHMR).toBeUndefined();
  expect(background.context['__webpack_require__'].lynxHMRLoad).toBeUndefined();
  background.acknowledge({ sequence: 1, ok: true, hash: 'late' });
  expect(background.context['__webpack_require__'].lynxHMR).toBeUndefined();
  expect(background.context['__webpack_require__'].lynxHMRLoad).toBeUndefined();
});

it.each([null, 0, '', undefined])(
  'detects a consumed falsy thrown value: %s',
  async (value) => {
    const background = createBackground();
    const ready = background.coordinator.prepare('old');
    background.acknowledge({ sequence: 1, ok: true, hash: 'new' });
    await ready;
    background.context['thrown'] = value;
    runInContext(
      `
    var options={factory:function(){throw thrown;}};
    __webpack_require__.i[0](options);
    try { options.factory(); } catch(error) {}
  `,
      background.context,
    );
    expect(() => background.coordinator.finish('new')).toThrow(String(value));
  },
);

it('keeps legacy BTS loading when Native APIs exist but do not initialize the app wrapper', async () => {
  const legacy: string[] = [];
  const sections: string[] = [];
  let wrapperRuns = 0;
  const context = createContext({
    Promise,
    __webpack_require__: { p: '/', i: [] },
    lynx: {
      fetchBundle: (url: string) => Promise.resolve({ code: 0, url }),
      loadScript: (section: string) => {
        sections.push(section);
        return {
          init: () => {
            wrapperRuns++;
          },
        };
      },
      getCoreContext: () => ({ addEventListener: () => undefined }),
      requireModuleAsync: (
        name: string,
        callback: (error: null, result: unknown) => void,
      ) => {
        legacy.push(name);
        callback(null, name.endsWith('.json') ? { c: ['a'] } : { modules: {} });
      },
    },
  });
  runInContext(runtimeSource(backgroundRuntime), context);
  const load = (name: string) =>
    new Promise((resolve, reject) => {
      const loader = context['__webpack_require__'].lynxHMRLoad
        ?? context['lynx'].requireModuleAsync;
      loader(name, (error: Error, result: unknown) =>
        error ? reject(error) : resolve(result));
    });
  await expect(load('/main.old.hot-update.json')).resolves.toEqual({
    c: ['a'],
  });
  expect(context['__webpack_require__'].lynxHMRLoad).toBeUndefined();
  await expect(load('/a.old.hot-update.js')).resolves.toEqual({ modules: {} });
  expect(legacy).toEqual(['/main.old.hot-update.json', '/a.old.hot-update.js']);
  expect(sections).toEqual(['manifest']);
  expect(wrapperRuns).toBe(0);
});

it.each(['fetchBundle', 'loadScript', 'both'])(
  'retains the original BTS loader when the host is missing %s',
  missing => {
    const context = createContext({
      Promise,
      __webpack_require__: { p: '/', i: [] },
      lynx: {
        fetchBundle: missing === 'loadScript' ? handler : undefined,
        loadScript: missing === 'fetchBundle' ? handler : undefined,
        getCoreContext: () => ({ addEventListener: () => undefined }),
      },
    });
    runInContext(runtimeSource(backgroundRuntime), context);
    expect(context['__webpack_require__'].lynxHMRLoad).toBeUndefined();
  },
);

it.each(['fetch', 'code', 'manifest', 'chunk'])(
  'propagates a BTS Native %s failure without switching to the legacy loader',
  async stage => {
    const failure = new Error('Native update failed');
    const legacy = rs.fn();
    const context = createContext({
      Promise,
      __webpack_require__: { p: '/', i: [] },
      lynx: {
        getCoreContext: () => ({ addEventListener: () => undefined }),
        requireModuleAsync: legacy,
        fetchBundle: (url: string) =>
          stage === 'fetch'
            ? Promise.reject(failure)
            : Promise.resolve({
              code: stage === 'code' ? 3 : 0,
              url: 'canonical:' + url,
            }),
        loadScript: (
          section: string,
          { bundleName }: { bundleName: string },
        ) => {
          expect(bundleName).toBe('canonical:/main.old.hot-update.bundle');
          if (
            section === stage || stage === 'chunk' && section !== 'manifest'
          ) throw failure;
          return { c: ['a'] };
        },
      },
    });
    runInContext(runtimeSource(backgroundRuntime), context);
    const loader = context['__webpack_require__'].lynxHMRLoad;
    const load = (name: string) =>
      new Promise((resolve, reject) =>
        loader(
          name,
          (error: Error, result: unknown) =>
            error ? reject(error) : resolve(result),
        )
      );
    if (stage === 'chunk') {
      await load('/main.old.hot-update.json');
      await expect(load('/a.old.hot-update.js')).rejects.toThrow(
        'Native update failed',
      );
    } else {
      await expect(load('/main.old.hot-update.json')).rejects.toThrow(
        stage === 'code' ? '"code":3' : 'Native update failed',
      );
    }
    expect(context['__webpack_require__'].lynxHMRLoad).toBe(loader);
    expect(legacy).not.toHaveBeenCalled();
  },
);
