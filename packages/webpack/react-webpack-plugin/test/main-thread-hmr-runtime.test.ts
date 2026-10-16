// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// VM globals and evaluated factories are intentionally dynamic test boundaries.
/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */

import { createContext, runInContext } from 'node:vm';

import { expect, it } from '@rstest/core';

import backgroundRuntime from '../src/runtime/hmr-background.js';
import mainThreadRuntime from '../src/runtime/hmr-main-thread.js';

function runtimeSource(
  runtime: () => void,
  entryModules: string[] = [],
): string {
  return `(${
    runtime.toString()
      .replaceAll('$METHOD$', '"applyUpdate"')
      .replaceAll('$EVENT$', '"ready"')
      .replaceAll('$HOT_MODULE$', '"entry"')
      .replaceAll('$ENTRY_MODULES$', JSON.stringify(entryModules))
  })();`;
}

const handler = () => undefined;

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
    const context = createContext({ __webpack_require__: { i: interceptors } });
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

it('loads a versioned Native bundle and evaluates the update section only once for multiple chunks', async () => {
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
      loadScript: (section: string) => {
        loaded.push(section);
        return section === 'manifest'
          ? { c: ['a', 'b'] }
          : { 'a.old.js': { ids: ['a'] }, 'b.old.js': { ids: ['b'] } };
      },
    },
  });
  runInContext(runtimeSource(mainThreadRuntime), context);
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
  expect(await load('a.old.js')).toEqual({ ids: ['a'] });
  expect(await load('b.old.js')).toEqual({ ids: ['b'] });
  expect(fetched).toEqual(['http://localhost/main.old.hot-update.bundle']);
  expect(loaded).toEqual(['manifest', 'updates']);
});

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

function createBackground() {
  const requests: { session: string; sequence: number; hash: string }[] = [];
  let listener: (event: { data: string }) => void;
  let timeout: () => void;
  let cleared = 0;
  const context = createContext({
    Promise,
    setTimeout: (callback: () => void) => {
      timeout = callback;
      return 1;
    },
    clearTimeout: () => {
      cleared++;
    },
    __webpack_require__: { i: [] },
    lynx: {
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
    expire: () => timeout(),
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

it('fails a missing MTS completion at the deadline and ignores a late ACK', async () => {
  const background = createBackground();
  const ready = background.coordinator.prepare('old');
  background.expire();
  await expect(ready).rejects.toThrow('completion timed out');
  background.coordinator.stop();
  background.acknowledge({ sequence: 1, ok: true, hash: 'late' });
  await expect(background.coordinator.prepare('old')).rejects.toThrow(
    'transaction stopped',
  );
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
