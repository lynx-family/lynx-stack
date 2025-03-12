// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
// @ts-nocheck
import { test, expect, type Page, type Worker } from '@playwright/test';

const wait = async (ms: number) => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const goto = async (page: Page) => {
  await page.goto('/web-core.html', {
    waitUntil: 'load',
  });
  await wait(500);
};

async function getMainThreadWorker(page: Page): Promise<Worker | undefined> {
  await wait(100);
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
    // firefox dose not support this.
    test.skip(browserName === 'firefox');
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
    // firefox dose not support this.
    test.skip(browserName === 'firefox');
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
    // firefox dose not support this.
    test.skip(browserName === 'firefox');
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
  test('lynx.requireModule+sync-main.thread', async ({ page, browserName }) => {
    // firefox dose not support this.
    test.skip(browserName === 'firefox');
    await goto(page);
    const mainWorker = await getMainThreadWorker(page);
    await mainWorker.evaluate(() => {
      globalThis.runtime.renderPage = () => {};
    });
    const [hello, world] = await mainWorker!.evaluate(async () => {
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
    // firefox dose not support this.
    test.skip(browserName === 'firefox');
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
      return globalThis.registerDataProcessor;
    });
    expect(registerDataProcessor).toBe('pass');
  });

  test('createJSObjectDestructionObserver', async ({ page, browserName }) => {
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
});
