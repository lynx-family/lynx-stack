// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

function script(file) {
  return readFileSync(new URL(`../lib/${file}.js`, import.meta.url), 'utf8')
    .replace(/^import .*;\n/gm, '').replace(/^export /gm, '');
}

function refElement() {
  const attributes = new Map();
  return {
    getAttribute: name => attributes.get(name),
    setAttribute: (name, value) => attributes.set(name, value),
  };
}

function host(
  {
    deferMain = false,
    deferBackground = false,
    failBackground = false,
    missingStyle = false,
  } = {},
) {
  const listeners = new Map();
  const engineListeners = new Map();
  const backgroundListeners = new Map();
  const calls = [];
  let finishBackground;
  let finishMain;
  const bridge = {
    dispatchEvent: event => backgroundListeners.get(event.type)?.(event),
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: name => listeners.delete(name),
  };
  const runtime = thread => ({
    fetchBundle: url => ({
      then(resolve) {
        calls.push([thread, 'fetch', url]);
        const finish = () =>
          resolve({
            code: failBackground && thread === 'background' ? 1 : 0,
            url: `${url}?resolved`,
            error_msg: 'download failed',
          });
        if (deferBackground && thread === 'background') {
          finishBackground = finish;
        } else if (deferMain && thread === 'main') {
          finishMain = finish;
        } else finish();
      },
    }),
    loadScript: (section, options) => {
      calls.push([thread, 'script', section, options.bundleName]);
      return {
        create() {
          return {
            render(...args) {
              calls.push(['render', ...args]);
            },
            update(...args) {
              calls.push(['update', ...args]);
            },
            dispose() {
              calls.push(['dispose']);
            },
            setBackgroundReady() {
              calls.push(['background-ready']);
            },
          };
        },
      };
    },
    getJSContext: () => bridge,
    getEngine: () => ({
      addEventListener: (name, callback) => engineListeners.set(name, callback),
      removeEventListener: name => engineListeners.delete(name),
    }),
    getCoreContext: () => ({
      addEventListener: (name, fn) => backgroundListeners.set(name, fn),
      removeEventListener: name => backgroundListeners.delete(name),
      dispatchEvent: event => listeners.get(event.type)?.(event),
    }),
  });
  const background = { lynx: runtime('background') };
  const main = {
    lynx: runtime('main'),
    __LoadStyleSheet: (section, bundle) => {
      calls.push(['style', section, bundle]);
      return missingStyle ? undefined : {};
    },
    __AdoptStyleSheet: () => calls.push(['adopt']),
  };
  for (const context of [main, background]) {
    runInNewContext(
      script('shared/sections') + script('runtime/resolve-entry'),
      context,
    );
  }
  runInNewContext(script('runtime/prepare-background'), background);
  runInNewContext(script('runtime/load'), main);
  for (const context of [main, background]) {
    runInNewContext(script('runtime/background-bridge'), context);
  }
  runInNewContext(script('runtime/create'), main);
  return {
    create: main.createIsland,
    prepareBackground: background.prepareIslandBackground,
    install: background.installIslandBackground,
    backgroundListeners,
    load: (source, dispatch = background.prepareIslandBackground) =>
      main.loadIslandModule(source, dispatch),
    loadForRender: (source, dispatch = background.prepareIslandBackground) =>
      main.loadIslandModuleForRender(source, dispatch),
    calls,
    listeners,
    engineListeners,
    destroy: () => engineListeners.get('__DestroyLifetime')?.(),
    finish: () => finishBackground(),
    finishMain: () => finishMain(),
    allowBackground: () => {
      failBackground = false;
    },
  };
}

function reactHost(h, { deferBridge = false } = {}) {
  const slot = { current: null };
  const effects = [];
  const bridge = [];
  const errors = [];
  const statuses = [];
  const react = {
    useRef: current => ({ current }),
    runOnBackground: fn => (...args) =>
      deferBridge
        ? new Promise((resolve, reject) => {
          bridge.push(() => {
            try {
              resolve(fn(...args));
            } catch (error) {
              reject(error);
            }
          });
        })
        : Promise.resolve(fn(...args)),
    useMainThreadRef(initial) {
      slot.current ??= initial;
      return slot;
    },
    useCallback: fn => fn,
    useEffect: fn => effects.push(fn),
    runOnMainThread: fn => async (...args) => fn(...args),
    loadIslandModuleForRender: h.loadForRender,
    prepareIslandBackground: h.prepareBackground,
    lynx: { reportError: error => errors.push(error) },
  };
  runInNewContext(script('runtime/create'), react);
  runInNewContext(script('react/useIsland'), react);
  return {
    slot,
    effects,
    errors,
    statuses,
    render: (module, title) =>
      react.useIsland(module, {
        container: '#slot',
        props: { title },
        onStatusChange: status => statuses.push(status),
      }),
    resumeBackground() {
      deferBridge = false;
      for (const call of bridge.splice(0)) call();
    },
  };
}
const inlineReference = { expose: 'xml-card' };
const remoteReference = {
  expose: 'xml-card',
  entry: 'https://example.test/card.bundle',
};

async function loadReady(h, source) {
  const module = await h.load(source);
  await module.backgroundReady;
}

test('inline delivery loads host sections without a fetch; background initialization is cached', async () => {
  const h = host();
  await loadReady(h, inlineReference);
  await loadReady(h, inlineReference);
  assert.equal(h.calls.some(call => call[1] === 'fetch'), false);
  assert.equal(
    h.calls.filter(call => call[0] === 'background' && call[1] === 'script')
      .length,
    1,
  );
  assert.ok(
    h.calls.some(call =>
      call[1] === 'script' && call[2] === 'xml-card/main'
      && call[3] === '__Card__'
    ),
  );
  assert.ok(
    h.calls.some(call => call[0] === 'style' && call[2] === '__Card__'),
  );
  assert.equal(h.listeners.size, 0);
});

test('inline creation renders synchronously before returning, without a background reply', async () => {
  const h = host();
  const callbacks = [];
  const module = h.loadForRender(inlineReference, (source, replyEvent) => {
    callbacks.push(() => h.prepareBackground(source, replyEvent));
  });
  const instance = h.create(module, {
    container: '#slot',
    props: { title: 'First frame' },
  });
  assert.equal(h.calls.filter(call => call[0] === 'render').length, 1);
  assert.equal(h.calls.some(call => call[0] === 'background-ready'), false);
  callbacks[0]();
  await instance.backgroundReady;
  instance.dispose();
});

test('inline ref renders before effects and background startup; the effect takes over the same instance', async () => {
  const h = host();
  const react = reactHost(h, { deferBridge: true });
  const ref = react.render(inlineReference, 'First frame');
  ref(refElement());
  assert.equal(h.calls.filter(call => call[0] === 'render').length, 1);
  const first = react.slot.current.island;
  assert.equal(
    h.calls.some(call => call[0] === 'background' && call[1] === 'script'),
    false,
  );
  // Simulate background data differing from the initial main-thread props.
  react.effects.shift();
  react.render(inlineReference, 'Hydrated props');
  react.effects.shift()();
  assert.equal(react.slot.current.island, first);
  assert.equal(h.calls.filter(call => call[0] === 'render').length, 1);
  assert.equal(h.calls.filter(call => call[0] === 'dispose').length, 0);
  assert.equal(
    h.calls.findLast(call => call[0] === 'update')[1].title,
    'Hydrated props',
  );
  react.resumeBackground();
  await first.backgroundReady;
  ref(null);
});

test('remote refs wait for the effect and bundle download', async () => {
  const h = host({ deferMain: true });
  const react = reactHost(h);
  const ref = react.render(remoteReference, 'Remote');
  ref(refElement());
  assert.equal(h.calls.length, 0);
  react.effects.shift()();
  assert.equal(h.calls.some(call => call[0] === 'render'), false);
  h.finishMain();
  await react.slot.current.island.ready;
  assert.equal(h.calls.filter(call => call[0] === 'render').length, 1);
  ref(null);
});

test('detaching a remote ref cancels a queued download before node creation', async () => {
  const h = host({ deferMain: true });
  const react = reactHost(h);
  const ref = react.render(remoteReference, 'Remote');
  ref(refElement());
  react.effects.shift()();
  const current = react.slot.current.island;
  h.finishMain();
  ref(null);
  await assert.rejects(current.ready, /cancelled/);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.calls.some(call => call[0] === 'render'), false);
});

test('null data and detach before hydration cannot revive an inline instance', async () => {
  const h = host();
  const react = reactHost(h, { deferBridge: true });
  const ref = react.render(inlineReference, 'First frame');
  ref(refElement());
  const first = react.slot.current.island;
  ref(null);
  react.effects.shift();
  react.render(null, 'Removed');
  react.effects.shift()();
  ref(refElement());
  react.resumeBackground();
  await assert.rejects(first.backgroundReady, /cancelled/);
  assert.equal(h.calls.filter(call => call[0] === 'render').length, 1);
  assert.equal(h.calls.filter(call => call[0] === 'dispose').length, 1);
  assert.equal(h.calls.some(call => call[0] === 'background-ready'), false);
});

test('inline resource failures are reported without escaping the ref', async () => {
  const h = host({ missingStyle: true });
  const react = reactHost(h);
  const ref = react.render(inlineReference, 'Missing style');
  assert.doesNotThrow(() => ref(refElement()));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(react.statuses, ['render-error']);
  assert.equal(h.calls.some(call => call[0] === 'render'), false);
  assert.equal(h.listeners.size, 0);
  ref(null);
});

test('hydration ref handoff preserves the instance only for the same native container', async () => {
  const h = host();
  const react = reactHost(h);
  const ref = react.render(inlineReference, 'First frame');
  const element = refElement();
  ref(element);
  const first = react.slot.current.island;
  ref(null);
  ref(element);
  await Promise.resolve();
  assert.equal(react.slot.current.island, first);
  assert.equal(h.calls.filter(call => call[0] === 'render').length, 1);
  assert.equal(h.calls.some(call => call[0] === 'dispose'), false);
  ref(null);
  ref(refElement());
  assert.notEqual(react.slot.current.island, first);
  assert.equal(h.calls.filter(call => call[0] === 'render').length, 2);
  assert.equal(h.calls.filter(call => call[0] === 'dispose').length, 1);
  ref(null);
  await Promise.resolve();
  assert.equal(react.slot.current.island, null);
  assert.equal(h.calls.filter(call => call[0] === 'dispose').length, 2);
});

test('remote delivery main script, CSS and render proceed while background is pending', async () => {
  const h = host({ deferBackground: true });
  const ready = h.load(remoteReference);
  const xml = await ready;
  xml.create().render('#xml-content', {});
  assert.ok(h.calls.some(call => call[0] === 'adopt'));
  assert.ok(h.calls.some(call => call[0] === 'render'));
  assert.equal(h.calls.some(call => call[0] === 'background-ready'), false);
  assert.equal(h.listeners.size, 1);
  h.finish();
  await xml.backgroundReady;
  const scripts = h.calls.filter(call => call[1] === 'script');
  assert.equal(scripts.length, 2);
  assert.ok(
    scripts.every(call => call[3] === `${remoteReference.entry}?resolved`),
  );
  assert.equal(h.listeners.size, 0);
});

test('background errors preserve main rendering and background initialization can retry', async () => {
  const h = host({ failBackground: true });
  const xml = await h.load(remoteReference);
  await assert.rejects(xml.backgroundReady, /download failed/);
  const renderer = xml.create();
  renderer.render('#xml-content', {});
  renderer.update({});
  assert.equal(h.listeners.size, 0);
  assert.ok(h.calls.some(call => call[0] === 'adopt'));
  assert.ok(h.calls.some(call => call[0] === 'update'));
  h.allowBackground();
  await loadReady(h, remoteReference);
  assert.ok(h.calls.some(call => call[0] === 'adopt'));
});

test('background cache distinguishes sources and missing CSS rejects', async () => {
  const h = host();
  await loadReady(h, inlineReference);
  await loadReady(h, remoteReference);
  await loadReady(h, { ...inlineReference, expose: 'other-card' });
  assert.equal(
    h.calls.filter(call => call[0] === 'background' && call[1] === 'script')
      .length,
    3,
  );
  const broken = host({ missingStyle: true, deferBackground: true });
  await assert.rejects(
    broken.load(remoteReference),
    /Missing island stylesheet/,
  );
  assert.equal(broken.listeners.size, 0);
  assert.equal(broken.engineListeners.size, 0);
  broken.finish();
});

test('host dispatch errors are reported without preventing main-thread rendering', async () => {
  const h = host();
  const island = await h.load(inlineReference, () => {
    throw new Error('dispatch failed');
  });
  await assert.rejects(island.backgroundReady, /dispatch failed/);
  island.create().render('#content', {});
  assert.equal(h.listeners.size, 0);
  assert.equal(h.engineListeners.size, 0);
  assert.ok(h.calls.some(call => call[0] === 'render'));
});

test('destroying the page during the main fetch rejects the load and skips evaluation', async () => {
  const h = host({ deferMain: true });
  const loading = h.load(remoteReference);
  h.destroy();
  await assert.rejects(loading, /Island module load cancelled/);
  h.finishMain();
  await Promise.resolve();
  assert.equal(h.listeners.size, 0);
  assert.equal(h.engineListeners.size, 0);
  assert.equal(
    h.calls.some(call => call[0] === 'main' && call[1] === 'script'),
    false,
  );
  assert.equal(h.calls.some(call => call[0] === 'style'), false);
});

test('page destruction releases a pending readiness listener and ignores late ready', async () => {
  const h = host({ deferBackground: true });
  const xml = await h.load(remoteReference);
  h.destroy();
  await assert.rejects(xml.backgroundReady, /cancelled/);
  assert.equal(h.listeners.size, 0);
  assert.equal(h.engineListeners.size, 0);
  h.finish();
  await Promise.resolve();
  assert.equal(h.calls.some(call => call[0] === 'background-ready'), false);
});

test('createIsland renders with the latest props and can update before background readiness', async () => {
  const h = host({ deferMain: true, deferBackground: true });
  const dispose = h.install();
  const card = h.create(remoteReference, {
    container: '#slot',
    props: { title: 'first' },
  });
  const updated = card.update({ title: 'latest' });
  h.finishMain();
  await Promise.all([card.ready, updated]);
  assert.deepEqual(h.calls.filter(call => call[0] === 'render'), [[
    'render',
    '#slot',
    { title: 'latest' },
  ]]);
  await card.update({ title: 'rendered' });
  assert.deepEqual(h.calls.filter(call => call[0] === 'update'), [['update', {
    title: 'rendered',
  }]]);
  h.finish();
  await card.backgroundReady;
  card.dispose();
  card.dispose();
  assert.equal(h.calls.filter(call => call[0] === 'dispose').length, 1);
  await assert.rejects(card.update({}), /disposed/);
  dispose();
  assert.equal(h.backgroundListeners.size, 0);
});

test('dispose while loading cancels pending updates and prevents a late render', async () => {
  const h = host({ deferMain: true });
  h.install();
  const card = h.create(remoteReference, { container: '#slot', props: {} });
  const updated = card.update({});
  card.dispose();
  await Promise.all(
    [card.ready, updated, card.backgroundReady].map(p =>
      assert.rejects(p, /cancelled/)
    ),
  );
  h.finishMain();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.calls.some(call => call[0] === 'render'), false);
});

test('a failed background script leaves the rendered island usable', async () => {
  const h = host({ failBackground: true });
  h.install();
  const card = h.create(remoteReference, { container: '#slot', props: {} });
  await card.ready;
  await assert.rejects(card.backgroundReady, /download failed/);
  await card.update({});
  card.dispose();
});

test('a loaded module creates independent instances without another script load', async () => {
  const h = host();
  const module = await h.load(inlineReference);
  assert.equal(h.calls.some(call => call[0] === 'render'), false);
  const first = h.create(module, {
    container: '#first',
    props: { title: 'First' },
  });
  const second = h.create(module, {
    container: '#second',
    props: { title: 'Second' },
  });
  await Promise.all([first.ready, second.ready]);
  first.dispose();
  await second.update({ title: 'Still active' });
  await second.backgroundReady;
  assert.equal(
    h.calls.filter(call => call[0] === 'main' && call[1] === 'script').length,
    1,
  );
  assert.deepEqual(
    h.calls.filter(call => call[0] === 'render').map(call => call[1]),
    ['#first', '#second'],
  );
  assert.equal(h.calls.filter(call => call[0] === 'dispose').length, 1);
  second.dispose();
});

test('disposing a rendered instance prevents late background activation', async () => {
  const h = host({ deferBackground: true });
  h.install();
  const card = h.create(remoteReference, { container: '#slot', props: {} });
  await card.ready;
  card.dispose();
  h.finish();
  await assert.rejects(card.backgroundReady, /cancelled/);
  assert.equal(h.calls.some(call => call[0] === 'background-ready'), false);
});

test('remote references reject relative entry paths before fetching', async () => {
  const h = host();
  await assert.rejects(
    h.load({ expose: 'card', entry: './card.bundle' }),
    /absolute bundle URL/,
  );
  assert.equal(h.calls.some(call => call[1] === 'fetch'), false);
  assert.equal(h.listeners.size, 0);
  assert.equal(h.engineListeners.size, 0);
});

for (const refFirst of [false, true]) {
  const order = refFirst ? 'ref before effect' : 'effect before ref';
  test(`React updates the same island with ${order}`, async () => {
    const h = host();
    const slot = { current: null };
    const effects = [];
    const errors = [];
    const statuses = [];
    const react = {
      useRef: current => ({ current }),
      runOnBackground: fn => async (...args) => fn(...args),
      useMainThreadRef(initial) {
        slot.current ??= initial;
        return slot;
      },
      useCallback: fn => fn,
      useEffect: fn => effects.push(fn),
      runOnMainThread: fn => async (...args) => fn(...args),
      loadIslandModuleForRender: h.loadForRender,
      prepareIslandBackground: h.prepareBackground,
      lynx: { reportError: error => errors.push(error) },
    };
    runInNewContext(script('runtime/create'), react);
    runInNewContext(script('react/useIsland'), react);

    function IslandHost(source, title) {
      return react.useIsland(source, {
        container: '#slot',
        props: { title },
        onStatusChange: status => statuses.push(status),
      });
    }

    const ref = IslandHost(inlineReference, 'first');
    if (refFirst) ref(refElement());
    effects.shift()();
    if (!refFirst) ref(refElement());
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(statuses.filter(status => status === 'ready').length, 1);
    assert.equal(
      statuses.filter(status => status === 'background-ready').length,
      1,
    );
    IslandHost({ ...inlineReference }, 'second');
    effects.shift()();
    assert.deepEqual(h.calls.filter(call => call[0] === 'update').slice(-1), [[
      'update',
      {
        title: 'second',
      },
    ]]);
    IslandHost({ ...inlineReference, expose: 'another' }, 'third');
    effects.shift()();
    await new Promise(resolve => setImmediate(resolve));
    ref(null);
    await Promise.resolve();
    assert.deepEqual(
      h.calls.filter(call => ['render', 'dispose'].includes(call[0])).map(
        call => call[0],
      ),
      ['render', 'dispose', 'render', 'dispose'],
    );
    assert.deepEqual(errors, []);
  });
}
