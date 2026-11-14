// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import './jsdom.js';
import { afterEach, describe, expect, rstest, test } from '@rstest/core';
import { JSDOM } from 'jsdom';
import { createIFrameRealm } from '../ts/client/mainthread/createIFrameRealm.js';

const windows: JSDOM[] = [];

afterEach(() => {
  rstest.unstubAllGlobals();
  for (const dom of windows.splice(0)) dom.window.close();
});

async function createRealm(scripts: Record<string, string>) {
  const dom = new JSDOM('<!doctype html><body></body>', {
    url: 'http://localhost/',
    runScripts: 'dangerously',
  });
  windows.push(dom);
  rstest.stubGlobal('document', dom.window.document);
  rstest.stubGlobal(
    'addEventListener',
    dom.window.addEventListener.bind(dom.window),
  );
  rstest.stubGlobal(
    'removeEventListener',
    dom.window.removeEventListener.bind(dom.window),
  );
  rstest.stubGlobal(
    'XMLHttpRequest',
    class {
      status = 200;
      responseText = '';
      open(_method: string, url: string) {
        if (!(url in scripts)) throw new Error('Missing script');
        this.responseText = scripts[url]!;
      }
      send() {}
    },
  );
  const pending = createIFrameRealm(dom.window.document.body);
  const iframe = dom.window.document.querySelector('iframe')!;
  dom.window.dispatchEvent(
    new dom.window.MessageEvent('message', {
      data: 'lynx:mtsready',
      source: iframe.contentWindow,
    }),
  );
  const realm = await pending;
  Object.assign(realm.globalWindow, {
    loadDependency: realm.loadScriptSync,
    XMLHttpRequest: globalThis.XMLHttpRequest,
  });
  return realm;
}

describe('iframe script exports', () => {
  test('keeps parent exports across nested loads', async () => {
    const source = `(function(module) {
      const child = loadDependency('shared');
      module.exports = { value: child.value, child };
    })(module);`;
    const realm = await createRealm({
      root: source,
      shared: '(function(module) { module.exports = { value: 42 }; })(module);',
    });
    const sentinel = { exports: { previous: true } };
    realm.globalWindow.module = sentinel;
    const result = realm.loadScriptSync('root');
    expect(result).toEqual({ value: 42, child: { value: 42 } });
    expect(realm.globalWindow.module).toBe(sentinel);
  });

  test('returns an async entry export after it synchronously loads a dependency', async () => {
    const realm = await createRealm({ shared: 'module.exports = 42;' });
    const pending = realm.loadScript('https://example.test/root.js');
    realm.globalWindow.eval(`(function(module) {
      module.exports = { value: loadDependency('shared') };
    })(module);`);
    realm.globalWindow.document.querySelector('script[src]')!.dispatchEvent(
      new realm.globalWindow.Event('load'),
    );
    expect(await pending).toEqual({ value: 42 });
  });

  test('keeps concurrent async entries separate when one loads a dependency', async () => {
    const realm = await createRealm({ shared: 'module.exports = 42;' });
    const first = realm.loadScript('https://example.test/first.js');
    const second = realm.loadScript('https://example.test/second.js');
    const scripts = realm.globalWindow.document.querySelectorAll('script[src]');
    realm.globalWindow.eval(`(function(module) {
      module.exports = { value: loadDependency('shared') };
    })(module);`);
    scripts[0]!.dispatchEvent(new realm.globalWindow.Event('load'));
    realm.globalWindow.eval('module.exports = "second";');
    scripts[1]!.dispatchEvent(new realm.globalWindow.Event('load'));
    expect(await first).toEqual({ value: 42 });
    expect(await second).toBe('second');
  });

  test('preserves outer exports when a dependency fails, and allows a later load', async () => {
    const realm = await createRealm({
      root: `try { loadDependency('missing'); } catch {}
        module.exports = 'recovered';`,
      next: `module.exports = 'next';`,
    });
    expect(realm.loadScriptSync('root')).toBe('recovered');
    expect(realm.loadScriptSync('next')).toBe('next');
  });
});
