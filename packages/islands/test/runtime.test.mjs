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

let nextContainerId = 0;
const refElement = () => ({ id: nextContainerId++ });
const reference = { expose: 'xml-card' };

function host(options = {}) {
  const flags = { ...options };
  const listeners = new Map();
  const engineListeners = new Set();
  const backgroundListeners = new Map();
  const pending = [];
  const fetches = [];
  const calls = [];
  const dispatch = callback => {
    if (flags.deferBackground) pending.push(callback);
    else callback();
  };
  const runtime = thread => ({
    fetchBundle(entry) {
      calls.push([thread, 'fetch', entry]);
      if (flags.throwFetch) throw new Error('fetch threw');
      return {
        then(callback) {
          const finish = () =>
            callback({
              url: flags.resolvedUrl ?? entry,
              code: flags.failFetch ? -1 : 0,
              error_msg: 'fetch failed',
            });
          if (flags.deferFetch) fetches.push(finish);
          else finish();
        },
      };
    },
    loadScript(section, options) {
      calls.push([thread, 'script', section, options.bundleName]);
      if (thread === 'background' && flags.failBackground) {
        throw new Error('background script failed');
      }
      if (thread === 'main' && flags.failMain) {
        throw new Error('main script failed');
      }
      if (flags.missingFactory) return {};
      return {
        create() {
          calls.push(['create']);
          return {
            render(container, props, { flush = true } = {}) {
              calls.push(['render', container, props]);
              if (flags.failRender) throw new Error('render failed');
              if (flush) calls.push(['flush']);
            },
            update(props) {
              calls.push(['update', props]);
              if (flags.failUpdate) throw new Error('update failed');
              calls.push(['flush']);
            },
            dispose() {
              calls.push(['dispose']);
              calls.push(['flush']);
            },
            setBackgroundReady: () => calls.push(['background-ready']),
          };
        },
      };
    },
    getJSContext: () => ({
      dispatchEvent: event =>
        dispatch(() => backgroundListeners.get(event.type)?.(event)),
      addEventListener: (name, callback) => listeners.set(name, callback),
      removeEventListener: name => listeners.delete(name),
    }),
    getNative: () => ({
      addEventListener: (_name, callback) => engineListeners.add(callback),
      removeEventListener: (_name, callback) =>
        engineListeners.delete(callback),
    }),
    getCoreContext: () => ({
      addEventListener: (name, callback) =>
        backgroundListeners.set(name, callback),
      removeEventListener: name => backgroundListeners.delete(name),
      dispatchEvent: event => listeners.get(event.type)?.(event),
    }),
  });
  const background = { lynx: runtime('background') };
  const main = {
    lynx: runtime('main'),
    __LoadStyleSheet: (section, bundle) => {
      calls.push(['style', section, bundle]);
      return flags.missingStyle ? undefined : {};
    },
    __AdoptStyleSheet: () => calls.push(['adopt']),
  };
  for (const context of [main, background]) {
    runInNewContext(script('shared/sections'), context);
    runInNewContext(script('runtime/fetch'), context);
  }
  runInNewContext(script('runtime/prepare-background'), background);
  runInNewContext(script('runtime/load'), main);
  for (const context of [main, background]) {
    runInNewContext(script('runtime/background-bridge'), context);
  }
  runInNewContext(script('runtime/create'), main);
  const prepareBackground = (source, replyEvent) =>
    dispatch(() => background.prepareIslandBackground(source, replyEvent));
  return {
    flags,
    calls,
    listeners,
    engineListeners,
    backgroundListeners,
    prepareBackground,
    load: (source = reference, prepare = prepareBackground) =>
      main.loadIslandModule(source, prepare),
    create: main.createIsland,
    install: background.installIslandBackground,
    destroy() {
      for (const callback of [...engineListeners]) callback();
    },
    finish() {
      flags.deferBackground = false;
      for (const callback of pending.splice(0)) callback();
    },
    finishFetch() {
      flags.deferFetch = false;
      for (const callback of fetches.splice(0)) callback();
    },
  };
}

function reactHost(h, { deferBridge = false, mainThread = true } = {}) {
  const slot = { current: null };
  const effects = [];
  const bridge = [];
  const errors = [];
  const statuses = [];
  let nativeContainer;
  const react = {
    __MAIN_THREAD__: mainThread,
    __GetPageElement: () => ({}),
    __QuerySelector: () => nativeContainer,
    __GetElementUniqueID: element => element.id,
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
    loadIslandModule: h.load,
    prepareIslandBackground: h.prepareBackground,
    lynx: { reportError: error => errors.push(error) },
  };
  runInNewContext(script('runtime/container'), react);
  runInNewContext(script('runtime/create'), react);
  runInNewContext(script('react/useIsland'), react);
  return {
    slot,
    effects,
    errors,
    statuses,
    render(module, title) {
      const ref = react.useIsland(module, {
        container: '#slot',
        props: { title },
        onStatusChange: status => statuses.push(status),
      });
      return element => {
        nativeContainer = element;
        ref(element);
      };
    },
    resumeBackground() {
      deferBridge = false;
      for (const callback of bridge.splice(0)) callback();
    },
  };
}

const flushes = h => h.calls.filter(call => call[0] === 'flush').length;
const nextTurn = () => new Promise(resolve => setImmediate(resolve));

test('module loading is synchronous, uses host sections and does not create an instance', async () => {
  const h = host();
  const module = h.load();
  assert.equal(typeof module.create, 'function');
  assert.equal(module.then, undefined);
  assert.equal(h.calls.some(call => call[0] === 'create'), false);
  assert.equal(h.calls.some(call => call[1] === 'fetch'), false);
  assert.ok(
    h.calls.some(call => call[0] === 'style' && call[2] === '__Card__'),
  );
  assert.ok(
    h.calls.some(call => call[0] === 'main' && call[2] === 'xml-card/main'),
  );
  await module.backgroundReady;
  assert.ok(
    h.calls.filter(call => call[1] === 'script').every(call =>
      call[3] === '__Card__'
    ),
  );
  assert.equal(h.listeners.size, 0);
  assert.equal(h.engineListeners.size, 0);
});

const remote = {
  ...reference,
  entry: 'https://example.test/cards.lynx.bundle',
};

test('remote resources use the resolved bundle URL on both threads and for CSS', async () => {
  const h = host({ resolvedUrl: 'https://example.test/resolved.lynx.bundle' });
  const module = await h.load(remote);
  await module.backgroundReady;
  assert.equal(h.calls.some(call => call[0] === 'create'), false);
  assert.deepEqual(
    h.calls.filter(call => call[1] === 'fetch').map(call => call[0]),
    ['main', 'background'],
  );
  assert.ok(
    h.calls.filter(call => call[1] === 'script').every(call =>
      call[3] === h.flags.resolvedUrl
    ),
  );
  assert.equal(
    h.calls.find(call => call[0] === 'style')[2],
    h.flags.resolvedUrl,
  );
  assert.equal(h.listeners.size, 0);
  assert.equal(h.engineListeners.size, 0);
});

test('background initialization distinguishes the same expose in separate bundles', async () => {
  const h = host();
  const modules = await Promise.all([
    h.load(remote),
    h.load(remote),
    h.load({ ...remote, entry: 'https://example.test/other.lynx.bundle' }),
    h.load(),
  ]);
  await Promise.all(modules.map(module => module.backgroundReady));
  assert.equal(
    h.calls.filter(call => call[0] === 'background' && call[1] === 'script')
      .length,
    3,
  );
});

for (const flag of ['failFetch', 'throwFetch']) {
  test(`remote ${flag} releases listeners and can retry`, async () => {
    const h = host({ [flag]: true });
    await assert.rejects(h.load(remote), /fetch/);
    await nextTurn();
    assert.equal(h.listeners.size, 0);
    assert.equal(h.engineListeners.size, 0);
    assert.equal(h.calls.some(call => call[1] === 'script'), false);
    h.flags[flag] = false;
    const module = await h.load(remote);
    await module.backgroundReady;
  });
}

test('relative remote URLs fail before fetching', async () => {
  const h = host();
  await assert.rejects(
    h.load({ ...remote, entry: 'cards.lynx.bundle' }),
    /absolute/,
  );
  assert.equal(h.calls.some(call => call[1] === 'fetch'), false);
  assert.equal(h.engineListeners.size, 0);
});

test('page destruction cancels a pending fetch before executing scripts or styles', async () => {
  const h = host({ deferFetch: true });
  const loading = h.load(remote);
  h.destroy();
  await assert.rejects(loading, /cancelled/);
  h.finishFetch();
  await nextTurn();
  assert.equal(
    h.calls.some(call => call[1] === 'script' || call[0] === 'style'),
    false,
  );
  assert.equal(h.engineListeners.size, 0);
});

test('pending remote rendering coalesces props and flushes after loading', async () => {
  const h = host({ deferFetch: true });
  const instance = h.create(h.load(remote), {
    container: '#slot',
    props: { title: 'Initial' },
  });
  const update = instance.update({ title: 'Latest' });
  assert.equal(h.calls.some(call => call[0] === 'create'), false);
  h.finishFetch();
  await update;
  await instance.backgroundReady;
  assert.deepEqual(h.calls.filter(call => call[0] === 'render'), [[
    'render',
    '#slot',
    { title: 'Latest' },
  ]]);
  assert.equal(flushes(h), 1);
  instance.dispose();
});

test('disposing a pending remote instance prevents late creation', async () => {
  const h = host({ deferFetch: true });
  const instance = h.create(h.load(remote), { container: '#slot', props: {} });
  instance.dispose();
  await assert.rejects(instance.ready, /cancelled/);
  h.finishFetch();
  await nextTurn();
  assert.equal(h.calls.some(call => call[0] === 'create'), false);
});

test('remote hydration reuses a pending instance with latest props and its own flush', async () => {
  const h = host({ deferFetch: true });
  const react = reactHost(h);
  const ref = react.render(remote, 'Initial');
  const element = refElement();
  ref(element);
  const first = react.slot.current.island;
  ref(null);
  react.effects.shift();
  react.render(remote, 'Latest')(element);
  react.effects.shift()();
  assert.equal(react.slot.current.island, first);
  h.finishFetch();
  await first.backgroundReady;
  assert.deepEqual(h.calls.filter(call => call[0] === 'render'), [[
    'render',
    '#slot',
    { title: 'Latest' },
  ]]);
  assert.equal(flushes(h), 1);
  ref(null);
});

test('switching remote URLs cannot render an older pending instance', async () => {
  const h = host({ deferFetch: true });
  const react = reactHost(h);
  const ref = react.render(remote, 'Old');
  ref(refElement());
  const first = react.slot.current.island;
  react.effects.shift();
  react.render(
    { ...remote, entry: 'https://example.test/other.lynx.bundle' },
    'New',
  );
  react.effects.shift()();
  const second = react.slot.current.island;
  assert.notEqual(first, second);
  h.finishFetch();
  await assert.rejects(first.ready, /cancelled/);
  await second.backgroundReady;
  assert.deepEqual(h.calls.filter(call => call[0] === 'render'), [[
    'render',
    '#slot',
    { title: 'New' },
  ]]);
  ref(null);
});

test('concurrent background initialization is shared per expose', async () => {
  const h = host();
  const modules = [h.load(), h.load(), h.load({ expose: 'other-card' })];
  await Promise.all(modules.map(module => module.backgroundReady));
  assert.equal(h.calls.filter(call => call[0] === 'background').length, 2);
  assert.equal(h.listeners.size, 0);
  assert.equal(h.engineListeners.size, 0);
});

for (
  const [flag, message] of [
    ['missingStyle', /Missing island stylesheet/],
    ['missingFactory', /Missing island module factory/],
    ['failMain', /main script failed/],
  ]
) {
  test(`${flag} throws synchronously without starting background work or leaking listeners`, () => {
    const h = host({ [flag]: true });
    assert.throws(() => h.load(), message);
    assert.equal(h.listeners.size, 0);
    assert.equal(h.engineListeners.size, 0);
    assert.equal(h.calls.some(call => call[0] === 'background'), false);
  });
}

test('rendering and local updates proceed before background initialization', async () => {
  const h = host({ deferBackground: true });
  const uninstall = h.install();
  const card = h.create(reference, {
    container: '#slot',
    props: { title: 'First' },
  });
  assert.deepEqual(h.calls.filter(call => call[0] === 'render'), [
    ['render', '#slot', { title: 'First' }],
  ]);
  await card.update({ title: 'Updated' });
  assert.equal(h.calls.some(call => call[0] === 'background-ready'), false);
  assert.equal(flushes(h), 2);
  h.finish();
  await card.backgroundReady;
  card.dispose();
  card.dispose();
  assert.equal(h.calls.filter(call => call[0] === 'dispose').length, 1);
  await assert.rejects(card.update({}), /disposed/);
  uninstall();
  assert.equal(h.backgroundListeners.size, 0);
});

test('background failure leaves main rendering usable and a new load can retry', async () => {
  const h = host({ failBackground: true });
  const module = h.load();
  const card = h.create(module, { container: '#slot', props: {} });
  await card.ready;
  await assert.rejects(card.backgroundReady, /background script failed/);
  await card.update({});
  assert.equal(h.listeners.size, 0);
  assert.equal(h.engineListeners.size, 0);
  h.flags.failBackground = false;
  await h.load().backgroundReady;
  assert.equal(h.calls.filter(call => call[0] === 'background').length, 2);
  card.dispose();
});

for (const asynchronous of [false, true]) {
  test(`dispatch errors preserve main rendering with asynchronous=${asynchronous}`, async () => {
    const h = host();
    const module = h.load(reference, () => {
      if (asynchronous) return Promise.reject(new Error('dispatch failed'));
      throw new Error('dispatch failed');
    });
    await assert.rejects(module.backgroundReady, /dispatch failed/);
    module.create().render('#slot', {});
    assert.equal(flushes(h), 1);
    assert.equal(h.listeners.size, 0);
    assert.equal(h.engineListeners.size, 0);
  });
}

test('page destruction cancels background readiness and cleans up late replies', async () => {
  const h = host({ deferBackground: true });
  const modules = [h.load(), h.load({ expose: 'other-card' })];
  h.destroy();
  await Promise.all(
    modules.map(module => assert.rejects(module.backgroundReady, /cancelled/)),
  );
  h.finish();
  await nextTurn();
  assert.equal(h.listeners.size, 0);
  assert.equal(h.engineListeners.size, 0);
});

test('destruction in the same turn as a ready reply still cancels activation', async () => {
  const h = host();
  const module = h.load(reference, (_source, replyEvent) => {
    h.listeners.get(replyEvent)({ data: { ok: true } });
    h.destroy();
  });
  await assert.rejects(module.backgroundReady, /cancelled/);
  assert.equal(h.listeners.size, 0);
  assert.equal(h.engineListeners.size, 0);
});

test('a failed renderer is disposed and reports its failure through readiness and updates', async () => {
  const h = host({ failRender: true });
  const card = h.create(h.load(), { container: '#slot', props: {} });
  await assert.rejects(card.ready, /render failed/);
  await assert.rejects(card.backgroundReady, /render failed/);
  await assert.rejects(card.update({}), /render failed/);
  card.dispose();
  assert.equal(h.calls.filter(call => call[0] === 'dispose').length, 1);
});

test('one loaded module creates independent instances and each renderer owns its commits', async () => {
  const h = host();
  const module = h.load();
  const first = h.create(module, {
    container: '#first',
    props: { title: 'First' },
  });
  const second = h.create(module, {
    container: '#second',
    props: { title: 'Second' },
  });
  await Promise.all([first.ready, second.ready]);
  assert.equal(flushes(h), 2);
  first.dispose();
  await second.update({ title: 'Still active' });
  await second.backgroundReady;
  assert.equal(h.calls.filter(call => call[0] === 'main').length, 1);
  assert.deepEqual(
    h.calls.filter(call => call[0] === 'render').map(call => call[1]),
    ['#first', '#second'],
  );
  second.dispose();
  assert.equal(flushes(h), 5);
});

test('disposing an instance prevents late background activation', async () => {
  const h = host({ deferBackground: true });
  const card = h.create(h.load(), { container: '#slot', props: {} });
  card.dispose();
  h.finish();
  await assert.rejects(card.backgroundReady, /cancelled/);
  assert.equal(h.calls.some(call => call[0] === 'background-ready'), false);
});

test('first-screen refs render before effects and hydration updates the same instance', async () => {
  const h = host();
  const react = reactHost(h, { deferBridge: true });
  const ref = react.render(reference, 'First frame');
  ref(refElement());
  const first = react.slot.current.island;
  assert.equal(h.calls.filter(call => call[0] === 'render').length, 1);
  assert.equal(flushes(h), 0);
  assert.equal(h.calls.some(call => call[0] === 'background'), false);
  react.effects.shift();
  react.render(reference, 'Hydrated props');
  react.effects.shift()();
  assert.equal(react.slot.current.island, first);
  assert.equal(
    h.calls.findLast(call => call[0] === 'update')[1].title,
    'Hydrated props',
  );
  assert.equal(flushes(h), 1);
  react.resumeBackground();
  await first.backgroundReady;
  ref(null);
});

test('detaching before hydration does not resurrect an instance', async () => {
  const h = host();
  const react = reactHost(h, { deferBridge: true });
  const ref = react.render(reference, 'First frame');
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
});

test('resource failures are reported from the ref and a later render retries', async () => {
  const h = host({ missingStyle: true });
  const react = reactHost(h);
  const ref = react.render(reference, 'First frame');
  assert.doesNotThrow(() => ref(refElement()));
  await nextTurn();
  assert.deepEqual(react.statuses, ['render-error']);
  assert.equal(react.slot.current.island, null);
  assert.equal(h.listeners.size, 0);
  h.flags.missingStyle = false;
  react.effects.shift()();
  await react.slot.current.island.backgroundReady;
  assert.equal(h.calls.filter(call => call[0] === 'render').length, 1);
  assert.equal(flushes(h), 1);
  ref(null);
});

test('hydration preserves the instance only for the same native container', async () => {
  const h = host();
  const react = reactHost(h);
  const ref = react.render(reference, 'First frame');
  const element = refElement();
  ref(element);
  const first = react.slot.current.island;
  ref(null);
  ref(element);
  await Promise.resolve();
  assert.equal(react.slot.current.island, first);
  assert.equal(
    h.calls.some(call => call[0] === 'update' || call[0] === 'dispose'),
    false,
  );
  assert.equal(flushes(h), 0);
  ref(null);
  ref(refElement());
  assert.notEqual(react.slot.current.island, first);
  assert.equal(h.calls.filter(call => call[0] === 'render').length, 2);
  assert.equal(flushes(h), 2);
  ref(null);
  await Promise.resolve();
  assert.equal(react.slot.current.island, null);
  assert.equal(h.calls.filter(call => call[0] === 'dispose').length, 2);
});

test('a failed update can retry with the same props', async () => {
  const h = host();
  const react = reactHost(h);
  const ref = react.render(reference, 'First frame');
  ref(refElement());
  react.effects.shift();
  h.flags.failUpdate = true;
  react.render(reference, 'Changed');
  react.effects.shift()();
  await nextTurn();
  assert.ok(react.statuses.includes('update-error'));
  h.flags.failUpdate = false;
  react.render(reference, 'Changed');
  react.effects.shift()();
  await nextTurn();
  assert.equal(h.calls.filter(call => call[0] === 'update').length, 2);
  assert.ok(react.statuses.includes('updated'));
  ref(null);
});

test('an earlier update failure preserves a newer different props snapshot', async () => {
  const h = host();
  const react = reactHost(h);
  const ref = react.render(reference, 'Initial');
  ref(refElement());
  react.effects.shift()();
  await react.slot.current.island.backgroundReady;

  h.flags.failUpdate = true;
  react.render(reference, 'Failed');
  react.effects.shift()();
  h.flags.failUpdate = false;
  react.render(reference, 'Newer');
  react.effects.shift()();
  await nextTurn();

  react.render(reference, 'Newer');
  react.effects.shift()();
  await nextTurn();
  assert.deepEqual(
    h.calls.filter(call => call[0] === 'update').map(call => call[1].title),
    ['Failed', 'Newer'],
  );
  assert.equal(
    react.statuses.filter(status => status === 'update-error').length,
    1,
  );
  assert.equal(react.statuses.filter(status => status === 'updated').length, 1);
  assert.deepEqual(react.errors, []);
  ref(null);
  await nextTurn();
});

for (const refFirst of [false, true]) {
  test(`later mounts flush and update the same instance with refFirst=${refFirst}`, async () => {
    const h = host();
    const react = reactHost(h, { mainThread: false });
    const ref = react.render(reference, 'Later mount');
    if (refFirst) ref(refElement());
    react.effects.shift()();
    if (!refFirst) ref(refElement());
    await react.slot.current.island.backgroundReady;
    assert.equal(flushes(h), 1);
    const first = react.slot.current.island;
    react.render(reference, 'Changed');
    react.effects.shift()();
    await nextTurn();
    assert.equal(react.slot.current.island, first);
    assert.equal(flushes(h), 2);
    react.render({ expose: 'other-card' }, 'Another module');
    react.effects.shift()();
    await react.slot.current.island.backgroundReady;
    assert.notEqual(react.slot.current.island, first);
    assert.equal(flushes(h), 4);
    ref(null);
    await nextTurn();
    assert.equal(flushes(h), 5);
    assert.deepEqual(react.errors, []);
  });
}
