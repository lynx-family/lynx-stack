// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
// @ts-nocheck
import { test, expect } from './coverage-fixture.js';
import type { Page, Worker } from '@playwright/test';

const ENABLE_MULTI_THREAD = !!process.env.ENABLE_MULTI_THREAD;
const isSSR = !!process.env['ENABLE_SSR'];

const wait = async (ms: number) => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const goto = async (page: Page, title?: string) => {
  let url = '/web-core.html';
  if (title) {
    url += `?casename=${title}`;
  }

  await page.goto(url, {
    waitUntil: 'load',
  });
  await wait(500);
};

async function getMainThreadWorker(
  page: Page,
): Promise<Worker | Page | undefined> {
  await wait(100);
  if (!ENABLE_MULTI_THREAD) {
    return page;
  } else {
    for (const i of page.workers()) {
      const isActive = await i.evaluate(() => {
        return globalThis.runtime !== undefined
          && globalThis.__lynx_worker_type === 'main';
      });

      if (isActive) {
        return i;
      }
    }
  }
}

async function getBackgroundThreadWorker(
  page: Page,
): Promise<Worker | undefined> {
  await wait(100);
  for (const i of page.workers()) {
    const isActive = await i.evaluate(() => {
      return globalThis.runtime !== undefined
        && globalThis.__lynx_worker_type === 'background';
    });

    if (isActive) {
      return i;
    }
  }
}

test.describe('web core tests', () => {
  test.skip(isSSR, 'not support ssr');
  test('selectComponent', async ({ page, browserName }) => {
    // firefox not support
    test.skip(browserName === 'firefox');
    await goto(page);
    const mainWorker = await getMainThreadWorker(page);
    await mainWorker.evaluate(() => {
      globalThis.runtime.renderPage = () => {
        const root = globalThis.runtime.__CreatePage('0', '0', {});
        const element = globalThis.runtime.__CreateElement('view', '0', {});
        globalThis.runtime.__AppendElement(root, element);
        const component = globalThis.runtime.__CreateComponent(
          '1',
          '0-13826000',
          '0',
          '',
          '',
          '',
          {},
          {},
        );
        globalThis.runtime.__AddClass(component, 'wrapper');
        globalThis.runtime.__AppendElement(element, component);
      };
    });
    const backWorker = await getBackgroundThreadWorker(page);
    const isSuccess = await backWorker.evaluate(() => {
      return new Promise(resolve => {
        globalThis.runtime.lynx.getNativeApp().selectComponent(
          'card',
          '.wrapper',
          true,
          (ids) => {
            if (Array.isArray(ids) && ids[0] === '0-13826000') {
              resolve(true);
            }
          },
        );
      });
    });
    await wait(1000);
    expect(isSuccess).toBeTruthy();
  });
  test('lynx.requireModuleAsync', async ({ page, browserName }) => {
    test.skip(
      browserName === 'firefox' && ENABLE_MULTI_THREAD,
      'firefox flaky',
    );
    await goto(page);
    const mainWorker = await getMainThreadWorker(page);
    await mainWorker.evaluate(() => {
      globalThis.runtime.renderPage = () => {};
    });
    const worker = await getBackgroundThreadWorker(page);
    const importedValue = await worker!.evaluate(async () => {
      const { promise, resolve } = Promise.withResolvers<string>();
      globalThis.runtime.lynx.requireModuleAsync(
        'manifest-chunk.js',
        (_, exports) => {
          resolve(exports);
        },
      );
      return promise;
    });
    expect(importedValue).toBe('hello');
  });
  test('lynx.requireModuleAsync-2', async ({ page, browserName }) => {
    test.skip(
      browserName === 'firefox' && ENABLE_MULTI_THREAD,
      'firefox flaky',
    );
    await goto(page);
    const mainWorker = await getMainThreadWorker(page);
    await mainWorker.evaluate(() => {
      globalThis.runtime.renderPage = () => {};
    });
    const worker = await getBackgroundThreadWorker(page);
    const [hello, world] = await worker!.evaluate(async () => {
      const chunk1 = Promise.withResolvers<string>();
      const chunk2 = Promise.withResolvers<string>();
      globalThis.runtime.lynx.requireModuleAsync(
        'manifest-chunk.js',
        (_, exports) => {
          chunk1.resolve(exports);
        },
      );
      globalThis.runtime.lynx.requireModuleAsync(
        'manifest-chunk2.js',
        (_, exports) => {
          chunk2.resolve(exports);
        },
      );
      return Promise.all([chunk1.promise, chunk2.promise]);
    });
    expect(hello).toBe('hello');
    expect(world).toBe('world');
  });
  test('lynx.requireModule+sync', async ({ page, browserName }) => {
    test.skip(
      browserName === 'firefox' && ENABLE_MULTI_THREAD,
      'firefox flaky',
    );
    await goto(page);
    const mainWorker = await getMainThreadWorker(page);
    await mainWorker.evaluate(() => {
      globalThis.runtime.renderPage = () => {};
    });
    const worker = await getBackgroundThreadWorker(page);
    const [hello, world] = await worker!.evaluate(async () => {
      const chunk1 = Promise.withResolvers<string>();
      const chunk2 = Promise.withResolvers<string>();
      globalThis.runtime.lynx.requireModuleAsync(
        'manifest-chunk.js',
        (_, exports) => {
          chunk1.resolve(exports);
        },
      );
      chunk2.resolve(
        globalThis.runtime.lynx.requireModule('manifest-chunk2.js'),
      );
      return Promise.all([chunk1.promise, chunk2.promise]);
    });
    expect(hello).toBe('hello');
    expect(world).toBe('world');
  });

  test('loadLepusChunk', async ({ page, browserName }) => {
    await goto(page);
    const mainWorker = await getMainThreadWorker(page);
    await mainWorker.evaluate(() => {
      globalThis.runtime.renderPage = () => {};
    });
    const [success, fail] = await mainWorker!.evaluate(async () => {
      return [
        globalThis.runtime.__LoadLepusChunk('manifest-chunk2.js'),
        globalThis.runtime.__LoadLepusChunk('manifest-chunk8.js'),
      ];
    });
    expect(success).toBe(true);
    expect(fail).toBe(false);
  });
  test('registerDataProcessor-as-global-var-update', async ({ page, browserName }) => {
    await goto(page);
    const mainWorker = await getMainThreadWorker(page);
    const registerDataProcessor = await mainWorker.evaluate(() => {
      return globalThis.runtime.registerDataProcessor;
    });
    expect(registerDataProcessor).toBe('pass');
  });

  test('createJSObjectDestructionObserver', async ({ page, browserName }) => {
    test.skip(); // https://github.com/microsoft/playwright/issues/34774
    // firefox dose not support this.
    test.skip(browserName === 'firefox');
    await goto(page);
    const mainWorker = await getMainThreadWorker(page);
    await mainWorker.evaluate(() => {
      globalThis.runtime.renderPage = () => {};
    });
    const backgroundWorker = await getBackgroundThreadWorker(page);
    const ret = await backgroundWorker!.evaluate(async () => {
      const { promise, resolve } = Promise.withResolvers<string>();
      let arrayCollected = false;
      let obj = globalThis.runtime.lynx.getNativeApp()
        .createJSObjectDestructionObserver(
          () => {
            arrayCollected = true;
            resolve('destructionObserver');
          },
        );
      obj = null;

      let counter = 0;
      (function allocateMemory() {
        // Allocate 50000 functions — a lot of memory!
        Array.from({ length: 50000 }, () => () => {});
        if (counter > 5000 || arrayCollected) return;
        counter++;
        // Use setTimeout to make each allocateMemory a different job
        setTimeout(allocateMemory);
      })();

      setTimeout(() => {
        let counter2 = 0;
        (function allocateMemory() {
          // Allocate 50000 functions — a lot of memory!
          Array.from({ length: 50000 }, () => () => {});
          if (counter2 > 5000 || arrayCollected) return;
          counter2++;
          // Use setTimeout to make each allocateMemory a different job
          setTimeout(allocateMemory);
        })();
      }, 3000);

      return promise;
    });
    expect(ret).toBe('destructionObserver');
  });

  test('api-onNapiModulesCall-func', async ({ page, browserName }) => {
    // firefox dose not support this.
    test.skip(browserName === 'firefox');
    await goto(page);
    const mainWorker = await getMainThreadWorker(page);
    await mainWorker.evaluate(() => {
      globalThis.runtime.renderPage = () => {};
    });
    await wait(3000);
    const backWorker = await getBackgroundThreadWorker(page);
    let successCallback = false;
    let successCallback2 = false;
    await page.on('console', async (message) => {
      if (message.text() === 'green') {
        successCallback = true;
      }
      if (message.text() === 'LYNX-VIEW') {
        successCallback2 = true;
      }
    });
    await backWorker.evaluate(() => {
      const nativeApp = globalThis.runtime.lynx.getNativeApp();
      const colorStarter = globalThis[`napiLoaderOnRT${nativeApp.id}`].load(
        'color_environment',
      );
      colorStarter.getColor();
    });
    await wait(100);
    expect(successCallback).toBeTruthy();
    expect(successCallback2).toBeTruthy();
  });
  test('api-onNapiModulesCall-class', async ({ page, browserName }) => {
    // firefox dose not support this.
    test.skip(browserName === 'firefox');
    await goto(page);
    const mainWorker = await getMainThreadWorker(page);
    await mainWorker.evaluate(() => {
      globalThis.runtime.renderPage = () => {};
    });
    await wait(3000);
    const backWorker = await getBackgroundThreadWorker(page);
    let successCallback = false;
    let successCallback2 = false;
    await page.on('console', async (message) => {
      if (message.text() === 'green') {
        successCallback = true;
      }
      if (message.text() === 'LYNX-VIEW') {
        successCallback2 = true;
      }
    });
    await backWorker.evaluate(() => {
      const nativeApp = globalThis.runtime.lynx.getNativeApp();
      const colorStarter = globalThis[`napiLoaderOnRT${nativeApp.id}`].load(
        'color_environment',
      );
      const engine = new colorStarter.ColorEngine();
      engine.getColor();
    });
    await wait(100);
    expect(successCallback).toBeTruthy();
    expect(successCallback2).toBeTruthy();
  });
  test('api-onNapiModulesCall-dispatchNapiModules', async ({ page, browserName }) => {
    // firefox dose not support this.
    test.skip(browserName === 'firefox');
    await goto(page);
    const mainWorker = await getMainThreadWorker(page);
    await mainWorker.evaluate(() => {
      globalThis.runtime.renderPage = () => {};
    });
    await wait(3000);
    const backWorker = await getBackgroundThreadWorker(page);
    let successDispatchNapiModule = false;
    await page.on('console', async (message) => {
      if (message.text() === 'bts:lynx-view') {
        successDispatchNapiModule = true;
      }
    });
    await backWorker.evaluate(() => {
      const nativeApp = globalThis.runtime.lynx.getNativeApp();
      const eventMethod = globalThis[`napiLoaderOnRT${nativeApp.id}`].load(
        'event_method',
      );
      eventMethod.bindEvent();
    });
    await wait(1000);
    await page.evaluate(() => {
      document.querySelector('lynx-view')?.click();
    });
    await wait(1000);
    expect(successDispatchNapiModule).toBeTruthy();
  });
  test('api-i18n-resources-translation', async ({ page, browserName }) => {
    // firefox dose not support this.
    test.skip(browserName === 'firefox');
    await goto(page);
    const mainWorker = await getMainThreadWorker(page);
    const success = await mainWorker.evaluate(() => {
      globalThis.runtime.renderPage = () => {};
      if (
        JSON.stringify(globalThis.runtime._I18nResourceTranslation({
          locale: 'en',
          channel: '1',
          fallback_url: '',
        })) === '{"hello":"hello","lynx":"lynx web platform1"}'
      ) {
        return true;
      }
    });
    await wait(2000);
    expect(success).toBeTruthy();
  });
  test('event-i18n-resources-missed', async ({ page, browserName }) => {
    // firefox dose not support this.
    test.skip(browserName === 'firefox');
    await goto(page);
    let success = false;
    await page.on('console', async (msg) => {
      const event = await msg.args()[0]?.evaluate((e) => {
        return {
          type: e.type,
          channel: e.detail?.channel,
        };
      });
      if (!event || event.type !== 'i18nResourceMissed') {
        return;
      }
      if (event.channel === '2') {
        success = true;
      }
    });
    const mainWorker = await getMainThreadWorker(page);
    await mainWorker.evaluate(() => {
      globalThis.runtime.renderPage = () => {};
      globalThis.runtime._I18nResourceTranslation({
        locale: 'en',
        channel: '2',
        fallback_url: '',
      });
    });
    await wait(2000);
    expect(success).toBeTruthy();
  });
  test('api-update-i18n-resources', async ({ page, browserName }) => {
    // firefox dose not support this.
    test.skip(browserName === 'firefox');
    await goto(page);
    const mainWorker = await getMainThreadWorker(page);
    const first = await mainWorker.evaluate(() => {
      globalThis.runtime.renderPage = () => {};
      if (
        globalThis.runtime._I18nResourceTranslation({
          locale: 'en',
          channel: '2',
          fallback_url: '',
        }) === undefined
      ) {
        return true;
      }
    });
    await wait(500);
    await page.evaluate(() => {
      document.querySelector('lynx-view').updateI18nResources([
        {
          options: {
            locale: 'en',
            channel: '1',
            fallback_url: '',
          },
          resource: {
            hello: 'hello',
            lynx: 'lynx web platform1',
          },
        },
        {
          options: {
            locale: 'en',
            channel: '2',
            fallback_url: '',
          },
          resource: {
            hello: 'hello',
            lynx: 'lynx web platform2',
          },
        },
      ], {
        locale: 'en',
        channel: '2',
        fallback_url: '',
      });
    });
    await wait(500);
    const second = await mainWorker.evaluate(() => {
      globalThis.runtime.renderPage = () => {};
      if (
        JSON.stringify(globalThis.runtime._I18nResourceTranslation({
          locale: 'en',
          channel: '2',
          fallback_url: '',
        })) === '{"hello":"hello","lynx":"lynx web platform2"}'
      ) {
        return true;
      }
    });
    await wait(500);
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
  });
  test('api-get-i18n-resource-by-mts', async ({ page, browserName }) => {
    // firefox dose not support this.
    test.skip(browserName === 'firefox');
    await goto(page);
    const mainWorker = await getMainThreadWorker(page);
    await mainWorker.evaluate(() => {
      globalThis.runtime.renderPage = () => {};
    });
    await wait(500);
    const backWorker = await getBackgroundThreadWorker(page);
    const first = await backWorker?.evaluate(() =>
      globalThis.runtime.lynx.getNativeLynx().getI18nResource() === undefined
    );
    await wait(500);
    await mainWorker?.evaluate(() => {
      globalThis.runtime._I18nResourceTranslation({
        locale: 'en',
        channel: '1',
        fallback_url: '',
      });
    });
    const second = await backWorker?.evaluate(() =>
      JSON.stringify(globalThis.runtime.lynx.getNativeLynx().getI18nResource())
        === '{"hello":"hello","lynx":"lynx web platform1"}'
    );
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
  });
  test('api-get-i18n-resource-by-lynx-update', async ({ page, browserName }) => {
    // firefox dose not support this.
    test.skip(browserName === 'firefox');
    await goto(page);
    const mainWorker = await getMainThreadWorker(page);
    await mainWorker.evaluate(() => {
      globalThis.runtime.renderPage = () => {};
    });
    await wait(500);
    const backWorker = await getBackgroundThreadWorker(page);
    const first = await backWorker?.evaluate(() =>
      globalThis.runtime.lynx.getNativeLynx().getI18nResource() === undefined
    );
    await wait(500);
    await page.evaluate(() => {
      document.querySelector('lynx-view').updateI18nResources([
        {
          options: {
            locale: 'en',
            channel: '1',
            fallback_url: '',
          },
          resource: {
            hello: 'hello',
            lynx: 'lynx web platform1',
          },
        },
        {
          options: {
            locale: 'en',
            channel: '2',
            fallback_url: '',
          },
          resource: {
            hello: 'hello',
            lynx: 'lynx web platform2',
          },
        },
      ], {
        locale: 'en',
        channel: '2',
        fallback_url: '',
      });
    });
    await wait(500);
    const second = await backWorker?.evaluate(() =>
      JSON.stringify(globalThis.runtime.lynx.getNativeLynx().getI18nResource())
        === '{"hello":"hello","lynx":"lynx web platform2"}'
    );
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
  });
  test('api-onI18nResourceReady-by-mts', async ({ page, browserName }) => {
    // firefox dose not support this.
    test.skip(browserName === 'firefox');
    await goto(page);
    const mainWorker = await getMainThreadWorker(page);
    await mainWorker.evaluate(() => {
      globalThis.runtime.renderPage = () => {};
    });
    await wait(500);
    let success = false;
    await page.on('console', async (message) => {
      if (message.text() === 'onI18nResourceReady') {
        success = true;
      }
    });
    const backWorker = await getBackgroundThreadWorker(page);
    await backWorker?.evaluate(() => {
      globalThis.runtime.GlobalEventEmitter.addListener(
        'onI18nResourceReady',
        () => {
          console.log('onI18nResourceReady');
        },
      );
    });
    await wait(500);
    await mainWorker?.evaluate(() => {
      globalThis.runtime._I18nResourceTranslation({
        locale: 'en',
        channel: '1',
        fallback_url: '',
      });
    });
    await wait(500);
    expect(success).toBeTruthy();
  });
  test('api-onI18nResourceReady-by-lynx-update', async ({ page, browserName }) => {
    // firefox dose not support this.
    test.skip(browserName === 'firefox');
    await goto(page);
    const mainWorker = await getMainThreadWorker(page);
    await mainWorker.evaluate(() => {
      globalThis.runtime.renderPage = () => {};
    });
    await wait(500);
    let success = false;
    await page.on('console', async (message) => {
      if (message.text() === 'onI18nResourceReady') {
        success = true;
      }
    });
    const backWorker = await getBackgroundThreadWorker(page);
    await backWorker?.evaluate(() => {
      globalThis.runtime.GlobalEventEmitter.addListener(
        'onI18nResourceReady',
        () => {
          console.log('onI18nResourceReady');
        },
      );
    });
    await wait(500);
    await page.evaluate(() => {
      document.querySelector('lynx-view').updateI18nResources([
        {
          options: {
            locale: 'en',
            channel: '1',
            fallback_url: '',
          },
          resource: {
            hello: 'hello',
            lynx: 'lynx web platform1',
          },
        },
        {
          options: {
            locale: 'en',
            channel: '2',
            fallback_url: '',
          },
          resource: {
            hello: 'hello',
            lynx: 'lynx web platform2',
          },
        },
      ], {
        locale: 'en',
        channel: '2',
        fallback_url: '',
      });
    });
    await wait(500);
    expect(success).toBeTruthy();
  });
  test('decode-css-in-js-warn', async ({ page, browserName }) => {
    // firefox not support
    test.skip(browserName === 'firefox');
    await goto(page, 'enable-css-selector-false');
    const mainWorker = await getMainThreadWorker(page);
    await mainWorker.evaluate(() => {
      globalThis.runtime.renderPage = () => {
        const root = globalThis.runtime.__CreatePage('0', '0', {});
        const container = globalThis.runtime.__CreateElement('view', '0', {});
        globalThis.runtime.__SetAttribute(container, 'l-css-id', '-1');
        globalThis.runtime.__SetAttribute(
          container,
          'style',
          'width: 100px;height: 100px; background-color: red',
        );
        globalThis.runtime.__AppendElement(root, container);
        globalThis.runtime.__AddClass(container, 'target');
      };
    });
    await wait(1000);
    const height = await page.evaluate(() =>
      getComputedStyle(document.querySelector('lynx-view')).getPropertyValue(
        'height',
      )
    );
    await wait(500);
    expect(height).toBe('100px');
  });
});
