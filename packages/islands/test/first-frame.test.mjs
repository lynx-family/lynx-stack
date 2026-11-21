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

import { createIslandFromModule } from '../lib/runtime/create.js';
import { loadIslandModuleForRender } from '../lib/runtime/load.js';

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

test('compiled first-screen ref survives real worklet hydration and delayed background startup', async () => {
  const listeners = new Map();
  const engine = new Map();
  const calls = [];
  const errors = [];
  const backgroundFunctions = new Map();
  const effects = [];
  let nextFunctionId = 0;
  Object.assign(globalThis, {
    __DEV__: false,
    __JS__: false,
    SystemInfo: { lynxSdkVersion: '4.2' },
    lynx: {
      reportError: error => errors.push(String(error)),
      getJSContext: () => ({
        addEventListener: (name, callback) => listeners.set(name, callback),
        removeEventListener: name => listeners.delete(name),
        dispatchEvent: () => undefined,
      }),
      getEngine: () => ({
        addEventListener: (name, callback) => engine.set(name, callback),
        removeEventListener: name => engine.delete(name),
      }),
      loadScript: () => ({
        create() {
          calls.push('create');
          return {
            render: (_container, props) => calls.push(['render', props.title]),
            update: props => calls.push(['update', props.title]),
            dispose: () => calls.push('dispose'),
            setBackgroundReady: () => calls.push('background-ready'),
          };
        },
      }),
    },
    __LoadStyleSheet: () => ({}),
    __AdoptStyleSheet: () => calls.push('style'),
    __GetAttributeByName: (element, name) => element[name],
    __SetAttribute: (element, name, value) => {
      element[name] = value;
    },
    __FlushElementTree: () => undefined,
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
    runOnMainThread: ctx => async (...args) => globalThis.runWorklet(ctx, args),
    createIslandFromModule,
    loadIslandModuleForRender,
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
      backgroundRef ??= { _type: 'main-thread', _wvid: 1, _initValue: initial };
      return backgroundRef;
    },
  });
  const reference = { expose: 'card' };
  const options = { container: '#slot', props: { title: 'First frame' } };
  const firstScreen = mainHook(reference, options);
  const element = {};
  globalThis.runWorklet(firstScreen, [{ elementRefptr: element }]);
  assert.deepEqual(calls, ['style', 'create', ['render', 'First frame']]);
  const firstInstance =
    globalThis.lynxWorkletImpl._refImpl._firstScreenWorkletRefMap[-1].current
      .island;
  await Promise.resolve();
  assert.equal(calls.includes('background-start'), false);

  const backgroundContext = backgroundHook(reference, {
    ...options,
    props: { title: 'Background props' },
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
  onHydrationFinished();
  assert.equal(
    globalThis.lynxWorkletImpl._refImpl._workletRefMap[1].current.island,
    firstInstance,
  );
  await effects.shift()();
  await firstInstance.backgroundReady;
  assert.deepEqual(errors, []);
  assert.equal(calls.filter(call => call === 'create').length, 1);
  assert.ok(
    calls.some(call =>
      Array.isArray(call) && call[0] === 'update'
      && call[1] === 'Background props'
    ),
  );
  assert.equal(calls.filter(call => call === 'background-start').length, 1);
  assert.equal(calls.filter(call => call === 'background-ready').length, 1);
  globalThis.runWorklet(hydrated, [null]);
  await Promise.resolve();
  assert.equal(calls.filter(call => call === 'dispose').length, 1);
  globalThis.lynxWorkletImpl._jsFunctionLifecycleManager.dispose();
});
