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
        mount(...args) {
          calls.push(['mount', ...args]);
        },
        update(...args) {
          calls.push(['update', ...args]);
        },
        unmount() {
          calls.push(['unmount']);
        },
        setBackgroundReady() {
          calls.push(['background-ready']);
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
      script('common/sections') + script('runtime/core/bundle'),
      context,
    );
  }
  runInNewContext(script('runtime/core/background'), background);
  runInNewContext(script('runtime/core/main'), main);
  for (const context of [main, background]) {
    runInNewContext(script('runtime/core/bridge'), context);
  }
  runInNewContext(script('runtime/core/mount'), main);
  return {
    mount: main.mountParcel,
    prepareBackground: background.prepareParcelBackground,
    install: background.installParcelBackground,
    backgroundListeners,
    load: (source, dispatch = background.prepareParcelBackground) =>
      main.loadParcel(source, dispatch),
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
const embedded = { kind: 'embedded', sectionPrefix: 'xml-card' };
const external = {
  kind: 'external',
  sectionPrefix: 'xml-card',
  url: 'https://example.test/card.bundle',
};

async function loadReady(h, source) {
  const xml = await h.load(source);
  await xml.backgroundReady;
}

test('embedded loads host sections without a fetch; background initialization is cached', async () => {
  const h = host();
  await loadReady(h, embedded);
  await loadReady(h, embedded);
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

test('external main script, CSS and mount proceed while background is pending', async () => {
  const h = host({ deferBackground: true });
  const ready = h.load(external);
  const xml = await ready;
  xml.mount('#xml-content', {});
  assert.ok(h.calls.some(call => call[0] === 'adopt'));
  assert.ok(h.calls.some(call => call[0] === 'mount'));
  assert.equal(h.calls.some(call => call[0] === 'background-ready'), false);
  assert.equal(h.listeners.size, 1);
  h.finish();
  await xml.backgroundReady;
  const scripts = h.calls.filter(call => call[1] === 'script');
  assert.equal(scripts.length, 2);
  assert.ok(scripts.every(call => call[3] === `${external.url}?resolved`));
  assert.equal(h.listeners.size, 0);
});

test('background errors preserve main rendering and background initialization can retry', async () => {
  const h = host({ failBackground: true });
  const xml = await h.load(external);
  await assert.rejects(xml.backgroundReady, /download failed/);
  xml.mount('#xml-content', {});
  xml.update({});
  assert.equal(h.listeners.size, 0);
  assert.ok(h.calls.some(call => call[0] === 'adopt'));
  assert.ok(h.calls.some(call => call[0] === 'update'));
  h.allowBackground();
  await loadReady(h, external);
  assert.ok(h.calls.some(call => call[0] === 'adopt'));
});

test('background cache distinguishes sources and missing CSS rejects', async () => {
  const h = host();
  await loadReady(h, embedded);
  await loadReady(h, external);
  await loadReady(h, { ...embedded, sectionPrefix: 'other-card' });
  assert.equal(
    h.calls.filter(call => call[0] === 'background' && call[1] === 'script')
      .length,
    3,
  );
  const broken = host({ missingStyle: true, deferBackground: true });
  await assert.rejects(broken.load(external), /Missing parcel stylesheet/);
  assert.equal(broken.listeners.size, 0);
  assert.equal(broken.engineListeners.size, 0);
  broken.finish();
});

test('host dispatch errors are reported without preventing main-thread mounting', async () => {
  const h = host();
  const parcel = await h.load(embedded, () => {
    throw new Error('dispatch failed');
  });
  await assert.rejects(parcel.backgroundReady, /dispatch failed/);
  parcel.mount('#content', {});
  assert.equal(h.listeners.size, 0);
  assert.equal(h.engineListeners.size, 0);
  assert.ok(h.calls.some(call => call[0] === 'mount'));
});

test('destroying the page during the main fetch rejects the load and skips evaluation', async () => {
  const h = host({ deferMain: true });
  const loading = h.load(external);
  h.destroy();
  await assert.rejects(loading, /Parcel load cancelled/);
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
  const xml = await h.load(external);
  h.destroy();
  await assert.rejects(xml.backgroundReady, /cancelled/);
  assert.equal(h.listeners.size, 0);
  assert.equal(h.engineListeners.size, 0);
  h.finish();
  await Promise.resolve();
  assert.equal(h.calls.some(call => call[0] === 'background-ready'), false);
});

test('mountParcel mounts with the latest props and can update before background readiness', async () => {
  const h = host({ deferMain: true, deferBackground: true });
  const dispose = h.install();
  const card = h.mount(external, {
    container: '#slot',
    props: { title: 'first' },
  });
  const updated = card.update({ title: 'latest' });
  h.finishMain();
  await Promise.all([card.mountPromise, updated]);
  assert.deepEqual(h.calls.filter(call => call[0] === 'mount'), [[
    'mount',
    '#slot',
    { title: 'latest' },
  ]]);
  await card.update({ title: 'mounted' });
  assert.deepEqual(h.calls.filter(call => call[0] === 'update'), [['update', {
    title: 'mounted',
  }]]);
  h.finish();
  await card.backgroundReady;
  card.unmount();
  card.unmount();
  assert.equal(h.calls.filter(call => call[0] === 'unmount').length, 1);
  await assert.rejects(card.update({}), /unmounted/);
  dispose();
  assert.equal(h.backgroundListeners.size, 0);
});

test('unmount while loading cancels pending updates and prevents a late mount', async () => {
  const h = host({ deferMain: true });
  h.install();
  const card = h.mount(external, { container: '#slot', props: {} });
  const updated = card.update({});
  card.unmount();
  await Promise.all(
    [card.mountPromise, updated, card.backgroundReady].map(p =>
      assert.rejects(p, /cancelled/)
    ),
  );
  h.finishMain();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.calls.some(call => call[0] === 'mount'), false);
});

test('a failed background script leaves the mounted parcel usable', async () => {
  const h = host({ failBackground: true });
  h.install();
  const card = h.mount(external, { container: '#slot', props: {} });
  await card.mountPromise;
  await assert.rejects(card.backgroundReady, /download failed/);
  await card.update({});
  card.unmount();
});

for (const refFirst of [false, true]) {
  const order = refFirst ? 'ref before effect' : 'effect before ref';
  test(`React updates the same parcel with ${order}`, async () => {
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
      loadParcel: h.load,
      prepareParcelBackground: h.prepareBackground,
      lynx: { reportError: error => errors.push(error) },
    };
    runInNewContext(script('runtime/core/mount'), react);
    runInNewContext(script('runtime/react/useParcel'), react);

    function ParcelHost(source, title) {
      return react.useParcel(source, {
        container: '#slot',
        props: { title },
        onStatusChange: status => statuses.push(status),
      });
    }

    const ref = ParcelHost(embedded, 'first');
    if (refFirst) ref({});
    effects.shift()();
    if (!refFirst) ref({});
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(statuses, ['mounted', 'background-ready']);
    ParcelHost({ ...embedded }, 'second');
    effects.shift()();
    assert.deepEqual(h.calls.filter(call => call[0] === 'update'), [['update', {
      title: 'second',
    }]]);
    ParcelHost({ ...embedded, sectionPrefix: 'another' }, 'third');
    effects.shift()();
    await new Promise(resolve => setImmediate(resolve));
    ref(null);
    assert.deepEqual(
      h.calls.filter(call => ['mount', 'unmount'].includes(call[0])).map(call =>
        call[0]
      ),
      ['mount', 'unmount', 'mount', 'unmount'],
    );
    assert.deepEqual(errors, []);
  });
}
