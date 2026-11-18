// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import './jsdom.js';
import { afterEach, describe, expect, rstest, test } from '@rstest/core';
import { JSDOM } from 'jsdom';
import { EngineMessageEventType } from '../ts/constants.js';
import type { Cloneable, JSRealm, PageConfig } from '../ts/types/index.js';
import type { LynxViewElement } from '../ts/client/mainthread/LynxView.js';
import { LynxViewInstance } from '../ts/client/mainthread/LynxViewInstance.js';
import { templateManager } from '../ts/client/mainthread/TemplateManager.js';
import { createIFrameRealm } from '../ts/client/mainthread/createIFrameRealm.js';

const windows: JSDOM[] = [];

afterEach(() => {
  rstest.restoreAllMocks();
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

const pageConfig: PageConfig = {
  enableCSSSelector: 'false',
  enableRemoveCSSScope: 'false',
  defaultDisplayLinear: 'true',
  defaultOverflowVisible: 'false',
  enableJSDataProcessor: 'false',
  isLazy: 'false',
  cardType: 'card',
};

function createCard(
  realm: JSRealm,
  initData: Cloneable,
  globalProps: Cloneable,
) {
  rstest.stubGlobal('cancelAnimationFrame', rstest.fn());
  const host = document.createElement('div') as unknown as LynxViewElement;
  document.body.append(host);
  const card = new LynxViewInstance(
    host,
    initData,
    globalProps,
    'http://localhost/card.web.bundle',
    host.attachShadow({ mode: 'open' }),
    realm,
    false,
    undefined,
  );
  rstest.spyOn(card.backgroundThread, 'startWebWorker').mockImplementation(
    () => {},
  );
  rstest.spyOn(card.backgroundThread, 'updateGlobalProps').mockResolvedValue(
    undefined,
  );
  rstest.spyOn(card.backgroundThread, 'updateData').mockResolvedValue(
    undefined,
  );
  rstest.spyOn(templateManager, 'getBundle').mockReturnValue({
    config: pageConfig,
  });
  return card;
}

describe('main-thread card host APIs in the iframe realm', () => {
  test('isolates initial data and props from the host', async () => {
    const realm = await createRealm({});
    const data = [{ list: [1, 2] }];
    const props = { theme: 'light' };
    const customSection = { items: ['host'] };
    await using card = createCard(realm, data, props);
    rstest.mocked(templateManager.getBundle).mockReturnValue({
      config: pageConfig,
      customSections: { settings: { content: customSection } },
    });
    card.onPageConfigReady(pageConfig);
    const result = realm.globalWindow.eval(`
      const result = {};
      globalThis.processData = data => {
        result.data = data instanceof Array
          && Object.getPrototypeOf(data[0]) === Object.prototype
          && data[0].list instanceof Array;
        data[0].list.push(3);
        return data;
      };
      globalThis.renderPage = data => {
        result.render = data instanceof Array && data[0].list.length === 3;
        result.props = lynx.__globalProps === __globalProps
          && __globalProps instanceof Object;
        __globalProps.theme = 'dark';
        result.systemInfo = SystemInfo === lynx.SystemInfo
          && SystemInfo instanceof Object && Object.isFrozen(SystemInfo);
        const section = lynx.getCustomSectionSync('settings');
        result.customSection = section instanceof Object && section.items instanceof Array;
        section.items.push('iframe');
      };
      result;
    `);

    card.onMTSScriptsExecuted();

    expect(result).toEqual({
      data: true,
      render: true,
      props: true,
      systemInfo: true,
      customSection: true,
    });
    expect(data).toEqual([{ list: [1, 2] }]);
    expect(props).toEqual({ theme: 'light' });
    expect(customSection.items).toEqual(['host']);
  });

  test('preserves null prototypes, shared references and own __proto__ data', async () => {
    const realm = await createRealm({});
    const record = Object.create(null);
    const value = { text: 'host' };
    record.value = value;
    record.__proto__ = value;
    record.self = record;
    await using card = createCard(realm, {}, record);
    card.onPageConfigReady(pageConfig);

    expect(realm.globalWindow.eval(`
      const record = lynx.__globalProps;
      const valid = Object.getPrototypeOf(record) === null
        && record.value instanceof Object && record.value === record.__proto__
        && Object.hasOwn(record, '__proto__') && record.self === record;
      record.value.text = 'iframe';
      valid;
    `)).toBe(true);
    expect(value.text).toBe('host');
  });

  test('clones update data and options for the processor and page callbacks', async () => {
    const realm = await createRealm({});
    await using card = createCard(realm, {}, {});
    card.onPageConfigReady(pageConfig);
    const result = realm.globalWindow.eval(`
      const result = [];
      globalThis.processData = (data, name) => {
        result.push([data instanceof Object, name]);
        data.value++;
        return data;
      };
      globalThis.updatePage = (data, options) => {
        result.push([data instanceof Object, options instanceof Object, data.value, options.processorName]);
      };
      globalThis.updatePageListener = ({ data: args }) => {
        result.push(args instanceof Array);
        updatePage(...args);
      };
      result;
    `);

    const data = { value: 1 };
    await card.updateData(data, 'first');
    const listener = realm.globalWindow.eval('updatePageListener');
    card.mainThreadGlobalThis.lynx.getEngine().addEventListener(
      EngineMessageEventType.UpdatePage,
      listener,
    );
    await card.updateData(data, 'second');

    expect(result).toEqual([
      [true, 'first'],
      [true, true, 2, 'first'],
      [true, 'second'],
      true,
      [true, true, 2, 'second'],
    ]);
    expect(data).toEqual({ value: 1 });
  });

  test('installs the latest global props even before page configuration', async () => {
    const realm = await createRealm({});
    await using card = createCard(realm, {}, { theme: 'initial' });
    await card.updateGlobalProps({ theme: 'updated' });
    card.onPageConfigReady(pageConfig);
    expect(realm.globalWindow.eval(`
      lynx.__globalProps === __globalProps && __globalProps.theme === 'updated'
    `)).toBe(true);
  });

  test('updates both global-props aliases before selecting the engine listener or global hook', async () => {
    const realm = await createRealm({});
    await using card = createCard(realm, {}, {});
    card.onPageConfigReady(pageConfig);
    const result = realm.globalWindow.eval(`
      const result = [];
      function record(source, data) {
        result.push([
          source, data.theme, data instanceof Object,
          data === __globalProps && data === lynx.__globalProps,
        ]);
        data.theme = 'script';
      }
      globalThis.updateGlobalProps = data => record('global hook', data);
      lynx.getEngine().addEventListener(
        '__UpdateGlobalProps',
        ({ data }) => record('engine', data[0]),
        { once: true },
      );
      result;
    `);
    const first = { theme: 'first' };
    const second = { theme: 'second' };

    await card.updateGlobalProps(first);
    await card.updateGlobalProps(second);

    expect(result).toEqual([
      ['engine', 'first', true, true],
      ['global hook', 'second', true, true],
    ]);
    expect(card.globalprops).toBe(card.mainThreadGlobalThis.__globalProps);
    expect(first.theme).toBe('first');
    expect(second.theme).toBe('second');
    expect(card.backgroundThread.updateGlobalProps).toHaveBeenNthCalledWith(
      2,
      { theme: 'second' },
    );
  });

  test('notifies both lifecycle contexts and cleans up after a native listener throws', async () => {
    const realm = await createRealm({});
    const card = createCard(realm, {}, {});
    card.onPageConfigReady(pageConfig);
    const logError = rstest.spyOn(console, 'error').mockImplementation(
      () => {},
    );
    const disposeEventListeners = rstest.spyOn(
      card.mtsWasmBinding,
      'disposeEventListeners',
    );
    let result;
    try {
      result = realm.globalWindow.eval(`
      const result = [];
      if (lynx.getNative() === lynx.getEngine()) throw new Error('Contexts must be distinct');
      lynx.getNative().addEventListener('__DestroyLifetime', event => {
        result.push(['native', event.type, event.data]);
        throw new Error('native cleanup failed');
      });
      lynx.getEngine().addEventListener('__DestroyLifetime', event => {
        result.push(['engine', event.type, event.data]);
      });
      result;
    `);
    } finally {
      await card[Symbol.asyncDispose]();
    }

    expect(result).toEqual([
      ['native', '__DestroyLifetime', undefined],
      ['engine', '__DestroyLifetime', undefined],
    ]);
    expect(logError).toHaveBeenCalledTimes(1);
    expect(disposeEventListeners).toHaveBeenCalled();
    expect(
      card.mainThreadGlobalThis.lynx.getNative().hasEventListener(
        EngineMessageEventType.DestroyLifetime,
      ),
    ).toBe(false);
  });
});
