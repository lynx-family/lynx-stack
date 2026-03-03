// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { test, expect } from '@lynx-js/playwright-fixtures';
import type { LynxViewElement } from '@lynx-js/web-core-wasm/client';
import type { Page, Worker } from '@playwright/test';

declare global {
  // eslint-disable-next-line no-var
  var runtime: any;
  // eslint-disable-next-line no-var
  var __lynx_worker_type: string;
}

const wait = async (ms: number) => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const goto = async (page: Page, title?: string) => {
  await page.goto('/?resourceName=web-core.main-thread.json', {
    waitUntil: 'load',
  });
  await wait(500);
};

async function getBackgroundThreadWorker(
  page: Page,
): Promise<Worker> {
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
  throw new Error('background thread worker not found');
}

test.describe('web core tests', () => {
  test('selectComponent', async ({ page, browserName }) => {
    // firefox not support
    test.skip(browserName === 'firefox');
    await goto(page);
    await page.evaluate(() => {
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
      globalThis.runtime.__FlushElementTree();
    });
    await wait(200);
    const backWorker = await getBackgroundThreadWorker(page);
    const isSuccess = await backWorker.evaluate(() => {
      return new Promise(resolve => {
        globalThis.runtime.lynx.getNativeApp().selectComponent(
          'card',
          '.wrapper',
          true,
          (ids: unknown) => {
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
      browserName === 'firefox',
      'firefox flaky',
    );
    await goto(page);
    const worker = await getBackgroundThreadWorker(page);
    const importedValue = await worker!.evaluate(async () => {
      const { promise, resolve } = Promise.withResolvers<string>();
      globalThis.runtime.lynx.requireModuleAsync(
        'manifest-chunk.js',
        (_: unknown, exports: string) => {
          resolve(exports);
        },
      );
      return promise;
    });
    expect(importedValue).toBe('hello');
  });
  test('lynx.requireModuleAsync-2', async ({ page, browserName }) => {
    test.skip(
      browserName === 'firefox',
      'firefox flaky',
    );
    await goto(page);
    const worker = await getBackgroundThreadWorker(page);
    const [hello, world] = await worker!.evaluate(async () => {
      const chunk1 = Promise.withResolvers<string>();
      const chunk2 = Promise.withResolvers<string>();
      globalThis.runtime.lynx.requireModuleAsync(
        'manifest-chunk.js',
        (_: unknown, exports: string) => {
          chunk1.resolve(exports);
        },
      );
      globalThis.runtime.lynx.requireModuleAsync(
        'manifest-chunk2.js',
        (_: unknown, exports: string) => {
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
      browserName === 'firefox',
      'firefox flaky',
    );
    await goto(page);

    const worker = await getBackgroundThreadWorker(page);
    const [hello, world] = await worker!.evaluate(async () => {
      const chunk1 = Promise.withResolvers<string>();
      const chunk2 = Promise.withResolvers<string>();
      globalThis.runtime.lynx.requireModuleAsync(
        'manifest-chunk.js',
        (_: unknown, exports: string) => {
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

    const [success, fail] = await page.evaluate(async () => {
      return [
        globalThis.runtime.__LoadLepusChunk('manifest-chunk2.js'),
        globalThis.runtime.__LoadLepusChunk('manifest-chunk8.js'),
      ];
    });
    expect(success).toBe(true);
    expect(fail).toBe(false);
  });

  test('api-nativeApp-readScript', async ({ page, browserName }) => {
    // firefox dose not support this.
    test.skip(browserName === 'firefox');
    await goto(page);

    await wait(3000);
    const backWorker = await getBackgroundThreadWorker(page);
    const jsonContent = await backWorker.evaluate(() => {
      const nativeApp = globalThis.runtime.lynx.getNativeApp();
      return nativeApp.readScript('json');
    });
    await wait(100);
    expect(jsonContent).toBe('{}');
  });
  test('registerDataProcessor-as-global-var-update', async ({ page, browserName }) => {
    await goto(page);
    const registerDataProcessor = await page.evaluate(() => {
      return globalThis.runtime.registerDataProcessor;
    });
    expect(registerDataProcessor).toBe('pass');
  });

  test('createJSObjectDestructionObserver', async ({ page, browserName }) => {
    test.skip(); // https://github.com/microsoft/playwright/issues/34774
    // firefox dose not support this.
    test.skip(browserName === 'firefox');
    await goto(page);

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

    await wait(3000);
    const backWorker = await getBackgroundThreadWorker(page);
    let successCallback = false;
    let successCallback2 = false;
    await page.on('console', async (message) => {
      if (message.text().includes('green')) {
        successCallback = true;
      }
      if (message.text().includes('LYNX-VIEW')) {
        successCallback2 = true;
      }
    });
    await backWorker.evaluate(() => {
      const nativeApp = globalThis.runtime.lynx.getNativeApp();
      // @ts-expect-error
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

    await wait(3000);
    const backWorker = await getBackgroundThreadWorker(page);
    let successCallback = false;
    let successCallback2 = false;
    await page.on('console', async (message) => {
      if (message.text().includes('green')) {
        successCallback = true;
      }
      if (message.text().includes('LYNX-VIEW')) {
        successCallback2 = true;
      }
    });
    await backWorker.evaluate(() => {
      const nativeApp = globalThis.runtime.lynx.getNativeApp();
      // @ts-expect-error
      const colorStarter = globalThis[`napiLoaderOnRT${nativeApp.id}`].load(
        'color_environment',
      );
      const engine = new colorStarter.ColorEngine();
      engine.getColor();
    });
    await wait(500);
    expect(successCallback).toBeTruthy();
    expect(successCallback2).toBeTruthy();
  });
  test('api-onNapiModulesCall-dispatchNapiModules', async ({ page, browserName }) => {
    // firefox dose not support this.
    test.skip(browserName === 'firefox');
    await goto(page);
    await wait(200);

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
      const eventMethod = (globalThis as any)[`napiLoaderOnRT${nativeApp.id}`]
        .load(
          'event_method',
        );
      eventMethod.bindEvent();
    });
    await wait(1000);
    await page.evaluate(() => {
      (document.querySelector('lynx-view') as HTMLElement)?.click();
    });
    await wait(1000);
    expect(successDispatchNapiModule).toBeTruthy();
  });
  test('api-i18n-resources-translation', async ({ page, browserName }) => {
    // firefox dose not support this.
    test.skip(browserName === 'firefox');
    await goto(page);
    const success = await page.evaluate(() => {
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
    await page.evaluate(() => {
      (document.querySelector('lynx-view') as LynxViewElement).addEventListener(
        'i18nResourceMissed',
        (event) => {
          // @ts-expect-error
          if (event.detail.channel === '2') {
            success = true;
          }
        },
      );
    });
    await page.evaluate(() => {
      globalThis.runtime._I18nResourceTranslation({
        locale: 'en',
        channel: '2',
        fallback_url: '',
      });
    });
    await wait(500);
    success = await page.evaluate<boolean>(() => {
      return success;
    });
    expect(success).toBeTruthy();
  });
  test('api-update-i18n-resources', async ({ page, browserName }) => {
    // firefox dose not support this.
    test.skip(browserName === 'firefox');
    await goto(page);
    const first = await page.evaluate(() => {
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
      (document.querySelector('lynx-view') as any)?.updateI18nResources([
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
    const second = await page.evaluate(() => {
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

    await wait(500);
    const backWorker = await getBackgroundThreadWorker(page);
    const first = await backWorker?.evaluate(() =>
      globalThis.runtime.lynx.getNativeLynx().getI18nResource() === undefined
    );
    await wait(500);
    await page.evaluate(() => {
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

    await wait(500);
    const backWorker = await getBackgroundThreadWorker(page);
    const first = await backWorker?.evaluate(() =>
      globalThis.runtime.lynx.getNativeLynx().getI18nResource() === undefined
    );
    await wait(500);
    await page.evaluate(() => {
      (document.querySelector('lynx-view') as any)?.updateI18nResources([
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
      (document.querySelector('lynx-view') as any)?.updateI18nResources([
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
  test('source-map-release', async ({ page, browserName }) => {
    // firefox not support
    test.skip(browserName === 'firefox');
    await goto(page);

    const backWorker = await getBackgroundThreadWorker(page);
    const isSuccess = await backWorker.evaluate(() => {
      return new Promise(resolve => {
        globalThis.runtime.lynx.getNativeApp().__SetSourceMapRelease({
          message: 'd73160119ef7e77776246caca2a7b98e',
        });
        resolve(
          globalThis.runtime.lynx.getNativeApp().__GetSourceMapRelease()
            === 'd73160119ef7e77776246caca2a7b98e',
        );
      });
    });
    await wait(1000);
    expect(isSuccess).toBeTruthy();
  });
});
