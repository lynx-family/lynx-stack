// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  hydrateWorkletCtx,
  onHydrationFinished,
  updateWorkletRefInitValueChanges,
} from '@lynx-js/react/worklet-runtime/bindings';
import { transformReactLynxSync } from '@lynx-js/react-transform';

import { getIslandContainerId } from '../lib/runtime/container.js';
import { createIslandFromModule } from '../lib/runtime/create.js';
import { loadIslandModule } from '../lib/runtime/load.js';

// Exercise the real worklet hydration implementation, including negative first-
// screen ref IDs and delayed background handles, without starting a native page.
const { initWorklet } = await import(
  new URL(
    './workletRuntime.js',
    import.meta.resolve('@lynx-js/react/worklet-runtime/init'),
  )
);
const source = readFileSync(
  new URL('../lib/react/useIsland.js', import.meta.url),
  'utf8',
);

function compile(target, helpers) {
  helpers = { ...helpers, __MAIN_THREAD__: target === 'LEPUS' };
  const result = transformReactLynxSync(source, {
    mode: 'test',
    filename: 'useIsland.js',
    pluginName: 'island-first-frame',
    sourcemap: false,
    snapshot: false,
    cssScope: false,
    dynamicImport: false,
    directiveDCE: false,
    defineDCE: false,
    shake: false,
    compat: false,
    refresh: false,
    worklet: {
      target,
      filename: 'useIsland.js',
      runtimePkg: '@lynx-js/react/internal',
    },
  });
  assert.deepEqual(result.errors, []);
  const code = result.code.replace(/^import[\s\S]*?;\n/gm, '').replace(
    /\bexport function /g,
    'function ',
  );
  return new Function(...Object.keys(helpers), `${code}\nreturn useIsland;`)(
    ...Object.values(helpers),
  );
}

for (
  const { changed, remote } of [
    { changed: false, remote: false },
    { changed: true, remote: false },
    { changed: false, remote: true },
    { changed: true, remote: true },
  ]
) {
  test(`compiled hydration ${changed ? 'applies changed props' : 'skips unchanged props'} with remote=${remote}`, async () => {
    const listeners = new Map();
    const engine = new Map();
    const calls = [];
    const errors = [];
    const backgroundFunctions = new Map();
    const effects = [];
    const fetches = [];
    let flushes = 0;
    let nextFunctionId = 0;
    let nativeContainer = { id: 1 };
    Object.assign(globalThis, {
      __DEV__: false,
      __JS__: false,
      __PROFILE__: false,
      SystemInfo: { lynxSdkVersion: '4.2' },
      lynx: {
        fetchBundle: url => ({
          then: callback => {
            fetches.push(() => callback({ code: 0, url }));
          },
        }),
        reportError: error => errors.push(String(error)),
        getJSContext: () => ({
          addEventListener: (name, callback) => listeners.set(name, callback),
          removeEventListener: name => listeners.delete(name),
          dispatchEvent: () => undefined,
        }),
        getNative: () => ({
          addEventListener: (name, callback) => engine.set(name, callback),
          removeEventListener: name => engine.delete(name),
        }),
        loadScript: () => ({
          create() {
            calls.push('create');
            return {
              render(_container, props, { flush = true } = {}) {
                calls.push(['render', props.title]);
                if (flush) globalThis.__FlushElementTree();
              },
              update(props) {
                calls.push(['update', props.title]);
                globalThis.__FlushElementTree();
              },
              dispose() {
                calls.push('dispose');
                globalThis.__FlushElementTree();
              },
              setBackgroundReady: () => calls.push('background-ready'),
            };
          },
        }),
      },
      __LoadStyleSheet: () => ({}),
      __AdoptStyleSheet: () => calls.push('style'),
      __GetPageElement: () => ({}),
      __QuerySelector: () => nativeContainer,
      __GetElementUniqueID: element => element.id,
      __FlushElementTree: () => flushes++,
    });
    initWorklet();
    const runOnBackground = handle => (...args) =>
      new Promise((resolve, reject) => {
        const call = id => {
          try {
            resolve(backgroundFunctions.get(id)(...args));
          } catch (error) {
            reject(error);
          }
        };
        if (handle._isFirstScreen) {
          globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl
            .delayRunOnBackground(handle, call);
        } else {
          call(handle._jsFnId);
        }
      });
    let mainRef;
    let backgroundRef;
    const helpers = {
      useRef: current => ({ current }),
      useCallback: fn => fn,
      runOnBackground,
      runOnMainThread: ctx => async (...args) =>
        globalThis.runWorklet(ctx, args),
      createIslandFromModule,
      getIslandContainerId,
      loadIslandModule,
      prepareIslandBackground(_reference, replyEvent) {
        calls.push('background-start');
        listeners.get(replyEvent)({ data: { ok: true } });
      },
      __registerWorklet: globalThis.registerWorklet,
      __transformToWorklet(fn) {
        const id = ++nextFunctionId;
        backgroundFunctions.set(id, fn);
        return { _jsFnId: id };
      },
    };
    const mainHook = compile('LEPUS', {
      ...helpers,
      useEffect: () => undefined,
      useMainThreadRef(initial) {
        mainRef = { _type: 'main-thread', _wvid: -1, _initValue: initial };
        return mainRef;
      },
    });
    const backgroundHook = compile('JS', {
      ...helpers,
      useEffect: fn => effects.push(fn),
      useMainThreadRef(initial) {
        backgroundRef ??= {
          _type: 'main-thread',
          _wvid: 1,
          _initValue: initial,
        };
        return backgroundRef;
      },
    });
    const reference = {
      expose: 'card',
      ...(remote ? { entry: 'https://example.test/cards.lynx.bundle' } : {}),
    };
    const options = { container: '#slot', props: { title: 'First frame' } };
    const firstScreen = mainHook(reference, options);
    const element = nativeContainer;
    globalThis.runWorklet(firstScreen, [{ elementRefptr: element }]);
    assert.deepEqual(
      calls,
      remote ? [] : ['style', 'create', ['render', 'First frame']],
    );
    assert.equal(flushes, 0);
    // Native commits after the host's synchronous first-screen rendering.
    globalThis.__FlushElementTree();
    const firstInstance =
      globalThis.lynxWorkletImpl._refImpl._firstScreenWorkletRefMap[-1].current
        .island;
    await Promise.resolve();
    assert.equal(flushes, 1, 'no extra container-identity or renderer flush');
    assert.equal(calls.includes('background-start'), false);

    const backgroundContext = backgroundHook(reference, {
      ...options,
      props: { title: changed ? 'Background props' : 'First frame' },
    });
    // Native patch transport serializes the background closure. Transforming a
    // main-thread worklet must not mutate the object the background effect holds.
    const hydrated = JSON.parse(JSON.stringify(backgroundContext));
    hydrated._execId = 1;
    updateWorkletRefInitValueChanges([[
      1,
      backgroundRef._initValue,
      'main-thread',
    ]]);
    // Both backends may clean up the old callback before adopting the new one.
    globalThis.runWorklet(firstScreen, [null]);
    hydrateWorkletCtx(hydrated, firstScreen);
    globalThis.runWorklet(hydrated, [{ elementRefptr: element }]);
    assert.equal(
      calls.some(call => Array.isArray(call) && call[0] === 'update'),
      false,
    );
    onHydrationFinished();
    assert.equal(
      globalThis.lynxWorkletImpl._refImpl._workletRefMap[1].current.island,
      firstInstance,
    );
    await effects.shift()();
    for (const finish of fetches.splice(0)) finish();
    await firstInstance.backgroundReady;
    assert.deepEqual(errors, []);
    assert.equal(calls.filter(call => call === 'create').length, 1);
    assert.deepEqual(
      calls.filter(call => Array.isArray(call) && call[0] === 'update'),
      changed && !remote ? [['update', 'Background props']] : [],
    );
    if (remote) {
      assert.deepEqual(
        calls.filter(call => Array.isArray(call) && call[0] === 'render'),
        [['render', changed ? 'Background props' : 'First frame']],
      );
    }
    const initialFlushes = changed || remote ? 2 : 1;
    assert.equal(flushes, initialFlushes);
    assert.equal(calls.filter(call => call === 'background-start').length, 1);
    assert.equal(calls.filter(call => call === 'background-ready').length, 1);
    // Replacing the container must not reuse the first render's flush:false.
    globalThis.runWorklet(hydrated, [null]);
    nativeContainer = { id: 2 };
    globalThis.runWorklet(hydrated, [{ elementRefptr: nativeContainer }]);
    await globalThis.lynxWorkletImpl._refImpl._workletRefMap[1].current.island
      .ready;
    assert.equal(calls.filter(call => call === 'create').length, 2);
    assert.equal(
      flushes,
      initialFlushes + 2,
      'replacement disposes and renders with native commits',
    );
    globalThis.runWorklet(hydrated, [null]);
    await Promise.resolve();
    assert.equal(calls.filter(call => call === 'dispose').length, 2);
    await Promise.resolve();
    assert.equal(
      flushes,
      initialFlushes + 3,
      'independent disposal still commits',
    );
    globalThis.lynxWorkletImpl._jsFunctionLifecycleManager.dispose();
  });
}
