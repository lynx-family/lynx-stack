// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { swipe, dragAndHold } from './utils.js';
import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import v8toIstanbul from 'v8-to-istanbul';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const wait = async (ms: number) => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const diffScreenShot = async (
  page: Page,
  caseName: string,
  subcaseName: string,
  label: string = 'index',
  screenshotOptions?: Parameters<
    ReturnType<typeof expect<Page>>['toHaveScreenshot']
  >[0],
) => {
  await expect(page).toHaveScreenshot([
    `${caseName}`,
    `${subcaseName}`,
    `${label}.png`,
  ], {
    maxDiffPixelRatio: 0,
    fullPage: true,
    animations: 'allow',
    ...screenshotOptions,
  });
};

const expectHasText = async (page: Page, text: string) => {
  const hasText = (await page.getByText(text).count()) === 1;
  await expect(hasText).toBe(true);
};

const expectNoText = async (page: Page, text: string) => {
  const hasText = (await page.getByText(text).count()) === 1;
  await expect(hasText).toBe(false);
};

const goto = async (page: Page, testname: string, hasDir?: boolean) => {
  await page.goto(`/?casename=${testname}${hasDir ? '&hasdir=true' : ''}`, {
    waitUntil: 'load',
  });
  await page.evaluate(() => document.fonts.ready);
};

test.describe('reactlynx3 tests', () => {
  test.beforeEach(async ({ page, browserName }) => {
    if (browserName === 'chromium') {
      await page.coverage.startJSCoverage({
        reportAnonymousScripts: true,
        resetOnNavigation: true,
      });
    }
  });
  test.describe('basic', () => {
    test('basic-pink-rect', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(100);
      const target = await page.locator('#target');
      await expect(target).toHaveCSS('height', '100px');
      await expect(target).toHaveCSS('width', '100px');
      await expect(target).toHaveCSS('background-color', 'rgb(255, 192, 203)');
    });

    test('basic-reload', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(100);
      const target = page.locator('#target');
      await target.click();
      await expect(await target.getAttribute('style')).toContain('green');
      await page.evaluate(() => {
        // @ts-expect-error
        globalThis.lynxView.reload();
      });
      await wait(100);
      await expect(await target.getAttribute('style')).toContain('pink');
    });
    test('basic-bindtap', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(100);
      const target = page.locator('#target');
      await target.click();
      await expect(await target.getAttribute('style')).toContain('green');
      await target.click();
      await expect(await target.getAttribute('style')).toContain('pink');
    });
    test('basic-class-selector', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(100);
      const computedStyle = await page.locator('#target').evaluate((dom) => {
        const style = getComputedStyle(dom);
        const height = style.height;
        const width = style.width;
        const backgroundColor = style.backgroundColor;
        return {
          height,
          width,
          backgroundColor,
        };
      });
      expect(computedStyle.height).toBe('100px');
      expect(computedStyle.width).toBe('100px');
      expect(computedStyle.backgroundColor).toBe('rgb(255, 192, 203)');
    });
    test('basic-setstate-in-constructor', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(100);
      await expectHasText(page, 'awesome');
    });
    test('basic-setsate-with-cb', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(100);
      await expectHasText(page, 'awesome');
      await expectNoText(page, 'success');
    });
    test('basic-globalProps', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(100);
      expect(await page.locator('#target').getAttribute('style')).toContain(
        'pink',
      );
    });
    test('basic-dataprocessor', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(100);
      expect(await page.locator('#target').getAttribute('style')).toContain(
        'green',
      );
    });
    test('basic-event-dataset', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(100);
      await page.locator('#target').click();
      await expect(
        page.locator('#val-a'),
        'currentTarget.dataset.camelCase works',
      )
        .toHaveAttribute('style', /green/g);
      await expect(
        page.locator('#obj-a'),
        'currentTarget.dataset.object.member works',
      ).toHaveAttribute('style', /green/g);
    });
    test('basic-event-bubble-dataset', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(100);
      await page.locator('#target').click();
      await expect(page.locator('#val-a'), 'target.dataset.camelCase works')
        .toHaveAttribute('style', /green/g);
      await expect(
        page.locator('#obj-a'),
        'target.dataset.object.member works',
      ).toHaveAttribute('style', /green/g);
    });
    test('basic-list-rendering', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(100);
      await expect(
        page.locator('#pink'),
      ).toHaveAttribute('style', /pink/g);
      await expect(
        page.locator('#orange'),
      ).toHaveAttribute('style', /orange/g);
      await expect(
        page.locator('#wheat'),
      ).toHaveAttribute('style', /wheat/g);
    });
    test(
      'basic-wrapper-element-do-not-impact-layout',
      async ({ page }, { title }) => {
        await goto(page, title);
        await wait(100);
        await expect(
          page.locator('#pink'),
        ).toHaveCSS('width', '60px');
        await expect(
          page.locator('#parent > * > #orange'),
        ).toHaveCSS('width', '60px');
        await expect(
          page.locator('#parent > * > #wheat'),
        ).toHaveCSS('width', '60px');
      },
    );
    test('basic-style-remove', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(100);
      const target = page.locator('#target');
      await expect(target).toHaveCSS('background-color', 'rgb(0, 128, 0)'); // green
      await target.click();
      await expect(target).toHaveCSS('background-color', 'rgb(255, 192, 203)'); // pink
      await target.click();
      await expect(target).toHaveCSS('background-color', 'rgb(0, 128, 0)'); // green
    });
    test('basic-style-remove-one-property', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(100);
      const target = page.locator('#target');
      await expect(target).toHaveCSS('background-color', 'rgb(0, 128, 0)'); // green
      await target.click();
      await expect(target).toHaveCSS('background-color', 'rgb(255, 192, 203)'); // pink
      await target.click();
      await expect(target).toHaveCSS('background-color', 'rgb(0, 128, 0)'); // green
    });
    test('basic-useeffect-hydrate', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(100);
      await expect(page.locator('#red')).toHaveCSS(
        'background-color',
        'rgb(255, 0, 0)',
      ); // red
      await expect(page.locator('#green')).toHaveCSS(
        'background-color',
        'rgb(0, 128, 0)',
      ); // green
      await expect(page.locator('#blue')).toHaveCSS(
        'background-color',
        'rgb(0, 0, 255)',
      ); // blue
      await expect(page.locator('#yellow')).toHaveCSS(
        'background-color',
        'rgb(255, 255, 0)',
      ); // yellow
    });
    test('basic-replaceelement', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(100);
      await expect(page.locator('#red')).toHaveCSS(
        'background-color',
        'rgb(255, 0, 0)',
      ); // red
      await expect(page.locator('#green')).toHaveCSS(
        'background-color',
        'rgb(0, 128, 0)',
      ); // green
      await expect(page.locator('#blue')).toHaveCSS(
        'background-color',
        'rgb(0, 0, 255)',
      ); // blue
      await expect(page.locator('#yellow')).toHaveCSS(
        'background-color',
        'rgb(255, 255, 0)',
      ); // yellow
    });
    test('basic-image', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(100);
      const target = await page.locator('#target');
      await expect(target).toHaveCSS('height', '100px');
      await expect(target).toHaveCSS('width', '100px');
    });
    test('basic-scroll-view', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(100);
      const target = await page.locator('#target');
      await expect(target).toHaveCSS('height', '100px');
      await expect(target).toHaveCSS('width', '100px');
      await expect(target).toHaveCSS('background-color', 'rgb(255, 192, 203)');
    });
  });
  test.describe('basic-css', () => {
    test('basic-css-asset-in-css', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(500);
      await diffScreenShot(page, title, 'show-lynx-logo');
    });
    test('basic-css-var', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(100);
      const computedStyle = await page.locator('#target').evaluate((dom) => {
        const style = getComputedStyle(dom);
        const backgroundColor = style.backgroundColor;
        return {
          backgroundColor,
        };
      });
      expect(computedStyle.backgroundColor).toBe('rgb(255, 192, 203)');
    });
  });
  test.describe('apis', () => {
    test('api-animation-event', async ({ page }, { title }) => {
      await goto(page, title);
      await page.locator('#tap1').click();
      await wait(1500);
      await expect(page.locator('#blue0')).toHaveCSS(
        'background-color',
        'rgb(0, 0, 238)',
      );
      await expectHasText(page, 'transitionstart transitionend');
      await page.locator('#tap3').click();
      await wait(1500);
      await expect(page.locator('#blue0')).toHaveCSS(
        'background-color',
        'rgb(0, 0, 238)',
      );
      await expectHasText(
        page,
        'animationstart animationiteration animationend',
      );
      await page.locator('#tap2').click();
      await wait(1000);
      await expect(page.locator('#blue1')).toHaveCSS(
        'background-color',
        'rgb(0, 0, 238)',
      );
      await expectHasText(
        page,
        'transitionstart transitionend transitionstart transitionend',
      );
      await page.locator('#tap4').click();
      await wait(1000);
      await expect(page.locator('#blue1')).toHaveCSS(
        'background-color',
        'rgb(0, 0, 238)',
      );
      await expectHasText(
        page,
        'animationstart animationiteration animationend animationstart animationiteration animationend',
      );
    });
    test('api-getJSModule', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(1000);
      expect(await page.locator('#target').getAttribute('style')).toContain(
        'pink',
      );
    });
    test('api-requestAnimationFrame', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(1000);
      await page.getByText('requestAnimationFrame').click();
      await wait(100);
      await expectHasText(page, 'loop');
      await page.getByText('cancelAnimationFrame').click();
      await wait(100);
      await expectHasText(page, 'stop');
    });

    test(
      'api-nativemodules-bridge-call',
      async ({ page }, { title }) => {
        await goto(page, title);
        await wait(500);
        const target = page.locator('#target');
        await expect(target).toHaveCSS('background-color', 'rgb(0, 128, 0)'); // green
      },
    );
    test(
      'api-nativemodules-call',
      async ({ page }, { title }) => {
        await goto(page, title);
        await wait(200);
        const target = page.locator('#target');
        await expect(target).toHaveCSS('background-color', 'rgb(0, 128, 0)'); // green
      },
    );
    test('api-SelectorQuery', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(500);
      await diffScreenShot(page, title, 'index');
    });

    test(
      'api-SystemInfo',
      async ({ page }, { title }) => {
        await goto(page, title);
        await wait(200);
        const target = page.locator('#target');
        await expect(target).toHaveCSS('background-color', 'rgb(0, 128, 0)'); // green
      },
    );

    test('api-initdata', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(100);
      await expect(page.locator('#target')).toHaveCSS(
        'background-color',
        'rgb(0, 128, 0)',
      ); // green;
    });

    test('api-lynx-performance', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(200);
      await expect(page.locator('#target')).toHaveCSS(
        'background-color',
        'rgb(0, 128, 0)',
      ); // green;
      // now check the html event
      await wait(200);
      const timingKeys = await page.evaluate(() => {
        // @ts-expect-error
        return Object.keys(globalThis.timing);
      });
      expect(timingKeys).toContain('create_lynx_start');
      expect(timingKeys).toContain('dispatch_start');
      expect(timingKeys).toContain('layout_start');
      expect(timingKeys).toContain('layout_end');
      expect(timingKeys).toContain('load_core_start');
      expect(timingKeys).toContain('ui_operation_flush_end');
      expect(timingKeys).toContain('ui_operation_flush_start');
      expect(timingKeys).toContain('decode_start');
      expect(timingKeys).toContain('decode_end');
      expect(timingKeys).toContain('lepus_excute_start');
      expect(timingKeys).toContain('load_template_start');
      expect(timingKeys).toContain('data_processor_start');
      expect(timingKeys).toContain('data_processor_end');
    });

    test('api-updateData', async ({ page }, { title }) => {
      await goto(page, title);
      const target = page.locator('#target');
      await expect(target).toHaveCSS('background-color', 'rgb(255, 192, 203)'); // pink
      await page.evaluate(() => {
        // @ts-expect-error
        globalThis.lynxView.updateData({ mockData: 'updatedData' }, 1, () => {
          console.log('update Data success');
        });
      });
      await wait(50);
      await expect(target).toHaveCSS(
        'background-color',
        'rgb(0, 128, 0)',
      ); // green;
    });

    test('api-updateData-callback', async ({ page }, { title }) => {
      let successCallback = false;
      await page.on('console', async (message) => {
        if (message.text() === 'update Data success') {
          successCallback = true;
        }
      });
      await goto(page, title);
      await wait(1000);
      await page.evaluate(() => {
        // @ts-expect-error
        globalThis.lynxView.updateData({ mockData: 'updatedData' }, 0, () => {
          console.log('update Data success');
        });
      });
      await wait(100);
      await expect(successCallback).toBe(true);
    });

    test('api-onNativeAppReady', async ({ page }, { title }) => {
      const messages: string[] = [];
      page.on('console', async (message) => {
        for (const arg of message.args()) {
          messages.push(JSON.stringify(await arg.jsonValue()));
        }
      });
      await goto(page, title);
      await wait(500);
      expect(messages.join(',')).toContain('uiThreadFpReady');
    });

    test('basic-at-rule-animation', async ({ page }, { title }) => {
      await goto(page, title);
      const target = page.locator('#target');
      await wait(400);
      await expect(target).toHaveCSS(
        'background-color',
        'rgb(0, 128, 0)',
      ); // green;
    });

    test('basic-at-rule-animation-from-to', async ({ page }, { title }) => {
      await goto(page, title);
      const target = page.locator('#target');
      await wait(400);
      await expect(target).toHaveCSS(
        'background-color',
        'rgb(0, 128, 0)',
      ); // green;
    });

    test('api-dispose', async ({ page }, { title }) => {
      await goto(page, title);
      const target = page.locator('#target');
      await expect(target).toHaveCSS('background-color', 'rgb(255, 192, 203)'); // pink
      const message: string[] = [];
      await page.on('console', (msg) => {
        message.push(msg.text());
      });
      await page.evaluate(() => {
        document.querySelector('lynx-view')!.remove();
      });
      await wait(50);
      expect(message).toContain('fin');
      expect(page.workers().length).toStrictEqual(1);
    });

    test('api-error', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(200);
      const target = await page.locator('lynx-view');
      expect(target).toHaveCSS('display', 'none');
    });

    test('api-preheat', async ({ page }, { title }) => {
      await goto(page, title);
      const target = page.locator('#target');
      await expect(target).toHaveCSS('background-color', 'rgb(255, 192, 203)'); // pink
      expect(page.workers().length).toStrictEqual(3);
    });

    test('api-preheat-at-least-one', async ({ page }, { title }) => {
      await goto(page, title);
      const target = page.locator('#target');
      await expect(target).toHaveCSS('background-color', 'rgb(255, 192, 203)'); // pink
      expect(page.workers().length).toBe(3);
      await page.evaluate(() => {
        document.body.querySelector('lynx-view')?.remove();
      });
      await wait(100);
      expect(page.workers().length).toBe(1);
      await page.evaluate(() => {
        const newView = document.createElement('lynx-view');
        newView.setAttribute('style', 'height:50vh; width:100vw;');
        newView.setAttribute('url', '/dist/api-preheat/main-thread.js');
        document.body.append(newView);
      });
      await page.evaluate(() => {
        const newView = document.createElement('lynx-view');
        newView.setAttribute('style', 'height:50vh; width:100vw;');
        newView.setAttribute('url', '/dist/api-preheat/main-thread.js');
        document.body.append(newView);
      });
      await wait(500);
      expect(page.workers().length).toBe(5);
    });

    test.describe('api-exposure', () => {
      const module = 'exposure';
      test(
        'api-exposure-area',
        async ({ page }, { title }) => {
          await goto(page, title);
          await diffScreenShot(page, module, title, 'initial');
          await page.evaluate(() => {
            // @ts-expect-error
            document.querySelector('lynx-view')!.shadowRoot!.querySelector(
              '#x',
            )!.scrollTo({ offset: 200 });
          });
          await wait(200);
          await diffScreenShot(
            page,
            module,
            title,
            'scroll-200-do-not-meet-exposure-area-requirement',
          );
          await wait(200);
          await page.evaluate(() => {
            // @ts-expect-error
            document.querySelector('lynx-view')!.shadowRoot!.querySelector(
              '#x',
            )!.scrollTo({ offset: 400 });
          });
          await diffScreenShot(page, module, title, 'scroll-200-green');
        },
      );

      test('api-exposure-basic', async ({ page, browserName }, { title }) => {
        test.skip(
          browserName === 'firefox',
          'test relies on the viewport width',
        );
        await goto(page, title);
        await wait(100);
        await diffScreenShot(page, module, title, '0-initial', {
          fullPage: true,
        });
        await wait(100);
        await page.evaluate(() => {
          // @ts-expect-error
          document.querySelector('lynx-view')!.shadowRoot!.querySelector('#x')!
            .scrollTo({ offset: 600 });
        });
        await wait(100);
        await diffScreenShot(page, module, title, '1-right-yellow', {
          fullPage: false,
        });
        await wait(100);
        await page.evaluate(() => {
          // @ts-expect-error
          document.querySelector('lynx-view')!.shadowRoot!.querySelector('#x')!
            .scrollTo({ offset: 0 });
        });
        await wait(100);
        await diffScreenShot(page, module, title, '2-white-back', {
          fullPage: false,
        });
        await wait(100);
        await page.evaluate(() => {
          // @ts-expect-error
          document.querySelector('lynx-view')!.shadowRoot!.querySelector('#y')!
            .scrollTo({ offset: 50 });
        });
        await wait(100);
        await diffScreenShot(page, module, title, '3-red-down', {
          fullPage: false,
        });
        await wait(100);
        await page.evaluate(() => {
          // @ts-expect-error
          document.querySelector('lynx-view')!.shadowRoot!.querySelector('#y')!
            .scrollTo({ offset: 0 });
        });
        await wait(100);
        await diffScreenShot(page, module, title, '4-white-down-back', {
          fullPage: false,
        });
      });

      test(
        'api-exposure-change-exposure-id',
        async ({ page, browserName }, { title }) => {
          test.skip(browserName !== 'chromium', 'flsky test');
          await goto(page, title);
          await wait(500);
          page.getByText('1').first().click();
          await wait(500);
          expect(await page.getByText('current: 1').count()).toBe(1);
          expect(await page.getByText('target index: 1').count()).toBe(1);
          page.getByText('2').first().click();
          await wait(500);
          expect(await page.getByText('current: 2').count()).toBe(1);
          expect(await page.getByText('target index: 2').count()).toBe(1);
          expect(await page.getByText('prev index: 1').count()).toBe(1);
          page.getByText('3').first().click();
          await wait(500);
          expect(await page.getByText('current: 3').count()).toBe(1);
          expect(await page.getByText('target index: 3').count()).toBe(1);
          expect(await page.getByText('prev index: 2').count()).toBe(1);
          page.getByText('4').first().click();
          await wait(500);
          expect(await page.getByText('current: 4').count()).toBe(1);
          expect(await page.getByText('target index: 4').count()).toBe(1);
          expect(await page.getByText('prev index: 3').count()).toBe(1);
        },
      );

      test('api-exposure-custom-event-handler', async ({ page }, { title }) => {
        await goto(page, title);
        await wait(500);
        await diffScreenShot(page, module, title, 'all-green', {
          fullPage: true,
        });
      });

      test(
        'api-exposure-dynamic-screen-margin',
        async ({ page }, { title }) => {
          await goto(page, title);
          await wait(100);
          await diffScreenShot(page, module, title, '0-initial', {
            fullPage: true,
          });
          await wait(100);
          await page.evaluate(() => {
            document.querySelector('lynx-view')!.shadowRoot!.querySelector(
              '#y',
            )!.scrollTop = 200;
          });
          await wait(100);
          await diffScreenShot(
            page,
            module,
            title,
            '1-orange-half-do-trigger',
            { fullPage: false },
          );
          await wait(100);
          await page.evaluate(() => {
            document.querySelector('lynx-view')!.shadowRoot!.querySelector(
              '#y',
            )!.scrollTop = 800;
          });
          await wait(100);
          await diffScreenShot(
            page,
            module,
            title,
            '2-green-half-not-trigger',
            { fullPage: false },
          );
          await wait(100);
          await page.evaluate(() => {
            document.querySelector('lynx-view')!.shadowRoot!.querySelector(
              '#y',
            )!.scrollTop = 1000;
          });
          await wait(100);
          await diffScreenShot(page, module, title, '3-green-half-do-trigger', {
            fullPage: false,
          });
        },
      );
      test('api-exposure-dynamic-ui-margin', async ({ page }, { title }) => {
        await goto(page, title);
        await wait(100);
        await diffScreenShot(page, module, title, '0-initial', {
          fullPage: true,
        });
        await wait(100);
        await page.evaluate(() => {
          document.querySelector('lynx-view')!.shadowRoot!.querySelector('#y')!
            .scrollTop = 200;
        });
        await wait(100);
        await diffScreenShot(page, module, title, '1-orange-half-do-trigger', {
          fullPage: false,
        });
        await wait(100);
        await page.evaluate(() => {
          document.querySelector('lynx-view')!.shadowRoot!.querySelector('#y')!
            .scrollTop = 800;
        });
        await wait(100);
        await diffScreenShot(page, module, title, '2-green-half-not-trigger', {
          fullPage: false,
        });
        await wait(100);
        await page.evaluate(() => {
          document.querySelector('lynx-view')!.shadowRoot!.querySelector('#y')!
            .scrollTop = 1000;
        });
        await wait(100);
        await diffScreenShot(page, module, title, '3-green-half-do-trigger', {
          fullPage: false,
        });
      });
      test('api-exposure-stop-events-has-complex-dataset', async ({ page }, {
        title,
      }) => {
        await goto(page, title);
        const message: string[] = [];
        await page.on('console', (msg) => {
          const text = msg.text();
          if (text.startsWith('pass')) {
            message.push(msg.text());
          }
        });
        await wait(100);
        await page.locator('#button').click();
        await wait(100);
        expect(message).toContain('pass:dataset2');
      });
      test('api-exposure-stop-events-has-dataset', async ({ page }, {
        title,
      }) => {
        const message: string[] = [];
        page.on('console', (msg) => {
          const text = msg.text();
          if (text.startsWith('pass')) {
            message.push(msg.text());
          }
        });
        await goto(page, title);
        await page.locator('#button').click();
        await wait(100);
        expect(message).toContain('pass:dataset1');
        expect(message).toContain('pass:dataset2');
      });
      test(
        'api-exposure-stop-exposure',
        async ({ page, browserName }, { title }) => {
          if (browserName === 'webkit') test.skip();
          await goto(page, title);
          await wait(300);
          page.getByText('lynx.stopExposure()').first().click();
          await wait(500);
          expect(await page.getByText('disexposure').count()).toBe(1);
          page.getByText('lynx.stopExposure({sendEvent: false})').first()
            .click();
          await wait(500);
          expect(await page.getByText('none').count()).toBe(1);
          page.getByText('lynx.stopExposure({sendEvent: true})').first()
            .click();
          await wait(500);
          expect(await page.getByText('disexposure').count()).toBe(1);
        },
      );
    });
    test('api-sendGlobalEvent', async ({ page }, { title }) => {
      await goto(page, title);
      const target = page.locator('#target');
      await expect(target).toHaveCSS('background-color', 'rgb(255, 192, 203)'); // pink
      await page.evaluate(() => {
        // @ts-expect-error
        globalThis.lynxView.sendGlobalEvent('event-test', ['change']);
      });
      await wait(100);
      await expect(target).toHaveCSS(
        'background-color',
        'rgb(0, 128, 0)',
      ); // green;
    });
    test('api-invoke-success', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(100);
      const result = page.locator('#result');
      await expect(result).toHaveCSS('background-color', 'rgb(255, 192, 203)'); // pink
      await page.locator('#target').click();
      await wait(100);
      await expect(result).toHaveCSS('background-color', 'rgb(0, 128, 0)'); // green
    });
    test('api-invoke-fail', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(100);
      const result = page.locator('#result');
      await expect(result).toHaveCSS('background-color', 'rgb(255, 192, 203)'); // pink
      await page.locator('#target').click();
      await wait(100);
      await expect(result).toHaveCSS('background-color', 'rgb(0, 128, 0)'); // green
    });
  });

  test.describe('configs', () => {
    test(
      'config-css-remove-scope-false',
      async ({ page }, { title }) => {
        await goto(page, title);
        await wait(100);
        await expect(
          page.locator('#index'),
        ).toHaveCSS('background-color', 'rgb(255, 0, 0)');
        await expect(
          page.locator('#sub'),
        ).toHaveCSS('background-color', 'rgb(0, 128, 0)');
      },
    );
    test(
      'config-css-remove-scope-true',
      async ({ page }, { title }) => {
        await goto(page, title);
        await wait(100);
        await expect(
          page.locator('#index'),
        ).toHaveCSS('background-color', 'rgb(0, 128, 0)');
        await expect(
          page.locator('#sub'),
        ).toHaveCSS('background-color', 'rgb(0, 128, 0)');
      },
    );
    test(
      'config-css-selector-false-exchange-class',
      async ({ page }, { title }) => {
        await goto(page, title);
        await wait(100);
        const target = page.locator('#target');
        await expect(target).toHaveCSS('background-color', 'rgb(0, 128, 0)'); // green
        await target.click();
        await expect(target).toHaveCSS('background-color', 'rgb(255, 255, 0)'); // yellow
        await target.click();
        await expect(target).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)'); // unset
      },
    );
    test(
      'config-css-selector-false-inline-css-change-same-time',
      async ({ page }, { title }) => {
        await goto(page, title);
        await wait(100);
        const target = page.locator('#target');
        await expect(target).toHaveCSS('background-color', 'rgb(255, 255, 0)'); // yellow
        await target.click();
        await expect(target).toHaveCSS('background-color', 'rgb(255, 0, 0)'); // red
        await target.click();
        await expect(target).toHaveCSS('background-color', 'rgb(255, 255, 0)'); // yellow
      },
    );
    test(
      'config-css-selector-false-inline-remove-css-remove-inline',
      async ({ page }, { title }) => {
        await goto(page, title);
        await wait(100);
        const target = page.locator('#target');
        await expect(target).toHaveCSS('background-color', 'rgb(0, 128, 0)'); // green
        await target.click();
        await expect(target).toHaveCSS('background-color', 'rgb(255, 0, 0)'); // red
        await target.click();
        await expect(target).toHaveCSS('background-color', 'rgb(255, 0, 0)'); // red
        await target.click();
        await expect(target).toHaveCSS('background-color', 'rgb(255, 255, 0)'); // yellow
        await target.click();
        await expect(target).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)'); // unset
      },
    );
    test(
      'config-css-selector-false-multi-level-selector',
      async ({ page }, { title }) => {
        await goto(page, title);
        await wait(100);
        const target = page.locator('#target');
        await expect(target).toHaveCSS(
          'background-color',
          'rgb(255, 192, 203)',
        ); // pink
      },
    );
    test(
      'config-css-selector-false-remove-all',
      async ({ page }, { title }) => {
        await goto(page, title);
        await wait(100);
        const target = page.locator('#target');
        await expect(target).toHaveCSS('background-color', 'rgb(0, 128, 0)'); // green
        await target.click();
        await expect(target).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)'); // unset
      },
    );
    test(
      'config-css-selector-false-remove-css-and-reuse-css',
      async ({ page }, { title }) => {
        await goto(page, title);
        await wait(100);
        const target = page.locator('#target');
        await expect(target).toHaveCSS('background-color', 'rgb(255, 255, 0)'); // yellow
        await target.click();
        await expect(target).toHaveCSS('background-color', 'rgb(0, 128, 0)'); // green
        await target.click();
        await expect(target).toHaveCSS('background-color', 'rgb(255, 255, 0)'); // yellow
      },
    );
    test(
      'config-css-selector-false-remove-css-and-style-collapsed',
      async ({ page }, { title }) => {
        await goto(page, title);
        await wait(100);
        const target = page.locator('#target');
        await expect(target).toHaveCSS('background-color', 'rgb(0, 128, 0)'); // green
        await target.click();
        await expect(target).toHaveCSS('background-color', 'rgb(255, 255, 0)'); // yellow
        await target.click();
        await expect(target).toHaveCSS('background-color', 'rgb(0, 128, 0)'); // green
      },
    );
    test(
      'config-css-selector-false-remove-inline-style-and-reuse-css',
      async ({ page }, { title }) => {
        await goto(page, title);
        await wait(100);
        const target = page.locator('#target');
        await expect(target).toHaveCSS('background-color', 'rgb(0, 128, 0)'); // green
        await target.click();
        await expect(target).toHaveCSS('background-color', 'rgb(255, 0, 0)'); // red
        await target.click();
        await expect(target).toHaveCSS('background-color', 'rgb(0, 128, 0)'); // green
      },
    );
    test(
      'config-css-selector-false-type-selector',
      async ({ page }, { title }) => {
        await goto(page, title);
        await wait(100);
        const target = page.locator('#target');
        await expect(target).toHaveCSS('background-color', 'rgb(255, 255, 0)'); // yellow
        await expect(target).toHaveCSS('width', '100px');
        await expect(target).toHaveCSS('height', '100px');
      },
    );
    test.fixme( // TODO(@colinaaa): update the template plugin
      'config-splitchunk-single-vendor',
      async ({ page }, { title }) => {
        await goto(page, title, true);
        await wait(1500);
        const target = page.locator('#target');
        await expect(target).toHaveCSS('background-color', 'rgb(0, 128, 0)'); // green
      },
    );
    test.fixme( // TODO(@colinaaa): update the template plugin
      'config-splitchunk-split-by-experience',
      async ({ page }, { title }) => {
        await goto(page, title, true);
        await wait(1500);
        const target = page.locator('#target');
        await expect(target).toHaveCSS('background-color', 'rgb(0, 128, 0)'); // green
      },
    );
    test.fixme( // TODO(@colinaaa): update the template plugin
      'config-splitchunk-split-by-module',
      async ({ page }, { title }) => {
        await goto(page, title, true);
        await wait(1500);
        const target = page.locator('#target');
        await expect(target).toHaveCSS('background-color', 'rgb(0, 128, 0)'); // green
      },
    );

    test.fixme( // TODO(@colinaaa): update the template plugin
      'config-splitchunk-error-assertPrefix',
      async ({ page }, { title }) => {
        await goto(page, title, true);
        await wait(1500);
        const target = page.locator('#target');
        await expect(target).toHaveCSS('background-color', 'rgb(0, 128, 0)'); // green
      },
    );

    test('config-mode-dev-with-all-in-one', async ({ page }, { title }) => {
      await goto(page, title, true);
      await wait(100);
      const target = page.locator('#target');
      await target.click();
      await expect(await target.getAttribute('style')).toContain('green');
      await target.click();
      await expect(await target.getAttribute('style')).toContain('pink');
    });
  });

  test.describe('elements', () => {
    test.describe('lynx-view', () => {
      const elementName = 'lynx-view';
      test('basic-element-lynx-view-not-auto', async ({ page }, { title }) => {
        await goto(page, title);
        await page.evaluate(() => {
          document.querySelector('lynx-view')!.setAttribute('width', '100vw');
          document.querySelector('lynx-view')!.setAttribute('height', '100vh');
          document.querySelector('lynx-view')!.setAttribute(
            'style',
            'width: 100vw; height: 100vh',
          );
        });
        await wait(100);
        await diffScreenShot(
          page,
          elementName,
          title,
        );
      });
    });
    test.describe('view', () => {
      const elementName = 'view';
      test(
        'basic-element-view-border-style-default',
        async ({ page }, { title }) => {
          await goto(page, title);
          await diffScreenShot(page, elementName, title);
        },
      );
    });
    test.describe('text', () => {
      test('basic-element-text-nest-text', async ({ page }, { title }) => {
        await goto(page, title);
        await wait(100);
        await diffScreenShot(page, 'text', 'nest-text');
      });

      test('basic-element-text-baseline', async ({ page }, { title }) => {
        await goto(page, title);
        await wait(100);
        await diffScreenShot(page, 'text', 'baseline');
      });

      test('basic-element-text-nest-image', async ({ page }, { title }) => {
        await goto(page, title);
        await wait(500); // for image loading
        await diffScreenShot(page, 'text', 'nest-image');
      });

      test('basic-element-text-nest-view', async ({ page }, { title }) => {
        await goto(page, title);
        await wait(100);
        await diffScreenShot(page, 'text', 'nest-view');
      });

      test(
        'basic-element-text-text-with-linear-gradient',
        async ({ page }, { title }) => {
          await goto(page, title);
          await wait(100);
          await diffScreenShot(
            page,
            'text',
            'linear-gradient',
            'gradient-text',
          );
        },
      );
      test.describe('basic-element-text-text-selection', () => {
        const title = 'basic-element-text-text-selection';

        test('selection-true-boolean-flatten-false', async ({ page, browserName }) => {
          await goto(page, title);
          if (browserName === 'webkit') {
            await page
              .getByText('text-selection-true-boolean-flatten-false')
              .first()
              .click({ 'clickCount': 3 });
          } else {
            await page
              .getByText('text-selection-true-boolean-flatten-false')
              .first()
              .selectText();
          }
          await wait(1000);
          await diffScreenShot(
            page,
            'text',
            'text-selection',
            'text-selection-true-boolean-flatten-false',
          );
        });

        test('text-selection-true-string-flatten-false', async ({ page }) => {
          await goto(page, title);
          await page
            .getByText('text-selection-true-string-flatten-false')
            .first()
            .selectText();
          await wait(1000);
          await diffScreenShot(
            page,
            'text',
            'text-selection',
            'text-selection-true-string-flatten-false',
          );
        });

        test('text-selection-false-string-flatten-false', async ({ page, browserName }) => {
          test.skip(browserName === 'firefox', 'firefox headless issue');
          await goto(page, title);
          await page
            .getByText('text-selection-false-string-flatten-false')
            .first()
            .selectText();
          await wait(1000);
          await diffScreenShot(
            page,
            'text',
            'text-selection',
            'text-selection-false-string-flatten-false',
          );
        });

        test('text-selection-false-boolean-flatten-false', async ({ page, browserName }) => {
          test.skip(browserName === 'firefox', 'firefox headless issue');
          await goto(page, title);
          await page
            .getByText('text-selection-false-boolean-flatten-false')
            .first()
            .selectText();
          await wait(1000);
          await diffScreenShot(
            page,
            'text',
            'text-selection',
            'text-selection-false-boolean-flatten-false',
          );
        });
      });

      test('basic-element-text-maxline', async ({ page }, { title }) => {
        await goto(page, title);
        await wait(100);
        await diffScreenShot(page, 'text', 'maxline');
      });

      test(
        'basic-element-text-maxlength',
        async ({ page, browserName }, { title }) => {
          test.skip(
            browserName === 'firefox',
            'firefox ResizeObserver detection is incorrect',
          ); // This is caused by the LynxView's auto size feature
          await goto(page, title);
          await wait(100);
          await diffScreenShot(page, 'text', 'maxlength');
        },
      );

      test(
        'basic-element-text-tail-color-convert',
        async ({ page }, { title }) => {
          await goto(page, title);
          await wait(100);
          await diffScreenShot(page, 'text', 'tail-color-convert');
        },
      );

      test('basic-element-text-display-none', async ({ page }, { title }) => {
        await goto(page, title);
        await wait(100);
        await diffScreenShot(page, 'text', 'display-none');
      });

      test(
        'basic-element-text-dynamic-text-style-update',
        async ({ page }, { title }) => {
          await goto(page, title);
          await wait(100);
          await diffScreenShot(page, 'text', title, 'initial');
          await page.getByTestId('updateStyle').click();
          await diffScreenShot(
            page,
            'text',
            title,
            'updated',
          );
        },
      );

      test(
        'basic-element-text-linear-gradient-color',
        async ({ page }, { title }) => {
          await goto(page, title);
          await wait(100);
          await diffScreenShot(page, 'text', 'linear-gradient-color');
          // Note that the color:linear-gradient() could be inherited on Android
          // TODO: fix this issue.
        },
      );

      test('basic-element-text-bindlayout', async ({ page }, { title }) => {
        test.skip(true, 'the text layout event should be improved'); // FIXME
        await goto(page, title);
        await wait(100);
        await diffScreenShot(page, 'text', 'bindlayout');
      });

      test(
        'basic-element-text-maxline-with-setData',
        async ({ page }, { title }) => {
          await goto(page, title);
          await wait(1500);
          await diffScreenShot(page, 'text/maxline-with-setData', 'index');
        },
      );

      test(
        'basic-element-text-set-native-props-text',
        async ({ page }, { title }) => {
          await goto(page, title);
          await wait(500);
          const count = (await page.getByText('the count is:1').count())
            + (await await page.getByText('the count is:2').count());
          expect(count).toBe(1);
        },
      );

      test('basic-element-text-set-native-props-with-maxlength', async ({
        page,
      }, { title }) => {
        await goto(page, title);
        await wait(200);
        await diffScreenShot(
          page,
          'text/set-native-props-with-maxlength',
          'index',
        );
      });

      test(
        'basic-element-text-set-native-props-text-do-not-change-inline-text',
        async ({
          page,
        }, { title }) => {
          await goto(page, title);
          await wait(500);
          let count = await page.getByText('hello').count();
          expect(count).toBe(1);
          count = await page.getByText('--').count();
          expect(count).toBe(1);
          count = await page.getByText('world').count();
          expect(count).toBe(1);
        },
      );

      test(
        'basic-element-text-set-native-props-with-setData',
        async ({ page }, { title }) => {
          await goto(page, title);
          await wait(200);
          // --initialtextinitial
          let count = await page.getByText('--').count();
          expect(count).toBe(1);
          count = await page.getByText('initial').count();
          expect(count).toBeGreaterThanOrEqual(1);
          await page.locator('#target').click();
          // nativeTextinitialtextinitial
          // -- -> nativeText
          count = await page.getByText('nativeText').count();
          expect(count).toBe(1);
          count = await page.getByText('initial').count();
          expect(count).toBeGreaterThanOrEqual(1);
          count = await page.getByText('--').count();
          expect(count).toBe(0);
          await page.locator('#target').click();
          // nativeTexthellotexthello
          count = await page.getByText('nativeText').count();
          expect(count).toBe(1);
          count = await page.getByText('hello').count();
          expect(count).toBeGreaterThanOrEqual(1);
          count = await page.getByText('initial').count();
          expect(count).toBe(0);
          await page.locator('#target').click();
          // 2ndNativeTexthellotexthello
          count = await page.getByText('2ndNative').count();
          expect(count).toBe(1);
          count = await page.getByText('hello').count();
          expect(count).toBeGreaterThanOrEqual(1);
          await page.locator('#target').click();
          // 2ndNativeworldtextworld
          count = await page.getByText('2ndNative').count();
          expect(count).toBe(1);
          count = await page.getByText('world').count();
          expect(count).toBeGreaterThanOrEqual(1);
        },
      );

      test('basic-element-text-word-break', async ({ page }, { title }) => {
        await goto(page, title);
        await diffScreenShot(page, 'text', 'word-break');
      });
    });
    test.describe('image', () => {
      test('basic-element-image-src', async ({ page }, { title }) => {
        await goto(page, title);
        await diffScreenShot(page, 'image', title);
      });
      test('basic-element-image-placeholder', async ({ page }, { title }) => {
        await goto(page, title);
        await diffScreenShot(page, 'image', 'placeholder');
      });

      test('basic-element-image-auto-size', async ({ page }, { title }) => {
        await goto(page, title);
        await diffScreenShot(page, 'image', 'auto-size', undefined, {
          fullPage: true,
        });
      });

      test(
        'basic-element-image-auto-size-with-padding',
        async ({ page }, { title }) => {
          await goto(page, title);
          await diffScreenShot(
            page,
            'image',
            'auto-size-with-padding',
            undefined,
            {
              fullPage: true,
            },
          );
        },
      );

      test(
        'basic-element-image-support-tap-event',
        async ({ page }, { title }) => {
          await goto(page, title);
          await page.locator('#img').first().click();
          expect(await page.locator('#result').getAttribute('class'))
            .toStrictEqual(
              'success',
            );
        },
      );

      test(
        'basic-element-image-border-radius',
        async ({ page }, { title }) => {
          await goto(page, title);
          await diffScreenShot(page, 'image', 'border-radius');
        },
      );
    });
    test.describe('x-blur-view', () => {
      const elementName = 'x-blur-view';
      test(
        'basic-element-x-blur-view-blur-radius',
        async ({ page, browserName }, { title }) => {
          test.skip(
            browserName !== 'chromium',
            'only chrome can show the blured image in screenshot',
          );
          await goto(page, title);
          await diffScreenShot(page, elementName, title);
        },
      );
      test(
        'basic-element-x-blur-view-default',
        async ({ page, browserName }, { title }) => {
          test.skip(
            browserName !== 'chromium',
            'only chrome can show the blured image in screenshot',
          );
          await goto(page, title);
          await diffScreenShot(page, elementName, title);
        },
      );
    });
    test.describe('x-foldview-ng', () => {
      const elementName = 'x-foldview-ng';
      test(
        'basic-element-x-foldview-ng-method-setFoldExpanded',
        async ({ page }, {
          title,
        }) => {
          await goto(page, title);
          await diffScreenShot(page, elementName, title, 'initial');
          await page.locator('#tap').click();
          await diffScreenShot(
            page,
            elementName,
            title,
            'should-be-scrolled-by-method',
          );
        },
      );
    });
    test.describe('svg', () => {
      test('basic-element-svg-bindload', async ({ page }, { title }) => {
        await goto(page, title);
        await expect(
          await page.locator('#result'),
        ).toHaveCSS(
          'background-color',
          'rgb(0, 128, 0)',
        );
      });

      test('basic-element-svg-hex-color', async ({ page }, { title }) => {
        await goto(page, title);
        await diffScreenShot(page, 'svg', 'hex-color');
      });

      test('basic-element-svg-utf8', async ({ page }, { title }) => {
        await goto(page, title);
        await diffScreenShot(page, 'svg', 'utf8');
      });

      test('basic-element-svg-with-css', async ({ page }, { title }) => {
        await goto(page, title);
        await diffScreenShot(page, 'svg', 'with-css');
      });
    });
    test.describe('scroll-view', () => {
      test(
        'basic-element-scroll-view-scrollable',
        async ({ page }, { title }) => {
          await goto(page, title);
          await wait(100);

          const testScrollable = async (
            selector: string,
            layoutDirection: 'x' | 'y',
            xScrollable: boolean,
            yScrollable: boolean,
          ) => {
            const locator = page.locator(selector);
            await expect(locator).toHaveCSS(
              'flex-direction',
              layoutDirection === 'x' ? 'row' : 'column',
            );
            await expect(locator).toHaveCSS(
              'overflow-x',
              xScrollable ? 'scroll' : 'hidden',
            );
            await expect(locator).toHaveCSS(
              'overflow-y',
              yScrollable ? 'scroll' : 'hidden',
            );
          };

          // horizontal layout(x), only when scroll-x is explicitly set as true
          await testScrollable('#scrollX', 'x', true, false);
          await testScrollable('#scrollXY', 'x', true, false);
          await testScrollable('#scrollXYFalse', 'x', true, false);

          // vertical layout(y)
          // await testScrollable('#scrollNoXNoY', 'y', false, true); //UB
          await testScrollable('#scrollYFalse', 'y', false, true);

          await testScrollable('#scrollY', 'y', false, true);
          // await testScrollable('#scrollXFalse', 'y', false, true); // UB
          await testScrollable('#scrollXFalseY', 'y', false, true);
          // await testScrollable('#scrollXFalseYFalse', 'y', false, true); // UB

          await page.locator('.toggle-scroll').click();
          await wait(50);
          await testScrollable('#scrollX', 'x', false, false);
          await testScrollable('#scrollY', 'y', false, false);
          await testScrollable('#scrollXY', 'x', false, false);
        },
      );

      test(
        'basic-element-scroll-view-event-scroll',
        async ({ page, browserName, context }, {
          title,
        }) => {
          test.skip(browserName !== 'chromium', 'not supoort CDPsession');
          await goto(page, title);
          await wait(300);
          const cdpSession = await context.newCDPSession(page);
          await swipe(cdpSession, {
            x: 100,
            y: 300,
            xDistance: 0,
            yDistance: -100,
          });
          await wait(100);
          const eventDetails = await page.evaluate(() => {
            const event = JSON.parse(
              document.querySelector('lynx-view')!.shadowRoot!.querySelector(
                '#result>raw-text',
              )!.innerHTML,
            );
            const { scrollTop, scrollLeft, scrollHeight, scrollWidth } =
              event.detail;
            return {
              type: event.type,
              detail: {
                scrollTop,
                scrollLeft,
                scrollHeight,
                scrollWidth,
              },
            };
          });
          expect(eventDetails.type).toBe('scroll');
          expect(eventDetails.detail.scrollTop).not.toBe(undefined);
          expect(eventDetails.detail.scrollLeft).not.toBe(undefined);
          expect(eventDetails.detail.scrollHeight).not.toBe(undefined);
          expect(eventDetails.detail.scrollWidth).not.toBe(undefined);
        },
      );

      test(
        'basic-element-scroll-view-event-scrollend',
        async ({ page, browserName, context }, {
          title,
        }) => {
          await goto(page, title);
          await wait(300);
          await page.evaluate(() => {
            document.querySelector('lynx-view')!.shadowRoot!.querySelector(
              'scroll-view',
            )!.scrollTop = 200;
          });
          await wait(200);
          const eventDetails = await page.evaluate(() => {
            const event = JSON.parse(
              document.querySelector('lynx-view')!.shadowRoot!.querySelector(
                '#result>raw-text',
              )!.innerHTML,
            );
            const { scrollTop, scrollLeft, scrollHeight, scrollWidth } =
              event.detail;
            return {
              type: event.type,
              detail: {
                scrollTop,
                scrollLeft,
                scrollHeight,
                scrollWidth,
              },
            };
          });
          expect(eventDetails.type).toBe('scrollend');
          expect(eventDetails.detail.scrollTop).not.toBe(undefined);
          expect(eventDetails.detail.scrollLeft).not.toBe(undefined);
          expect(eventDetails.detail.scrollHeight).not.toBe(undefined);
          expect(eventDetails.detail.scrollWidth).not.toBe(undefined);
        },
      );

      test('basic-element-scroll-view-event-scrolltoupper', async ({
        page,
        browserName,
        context,
      }, { title }) => {
        test.skip(browserName !== 'chromium', 'not supoort CDPsession');
        await goto(page, title);
        const cdpSession = await context.newCDPSession(page);
        await swipe(cdpSession, {
          x: 100,
          y: 300,
          xDistance: 0,
          yDistance: -200,
        });
        await wait(200);
        await swipe(cdpSession, {
          x: 100,
          y: 100,
          xDistance: 0,
          yDistance: 200,
        });
        await wait(600);
        const eventDetails = await page.evaluate(() => {
          const event = JSON.parse(
            document.querySelector('lynx-view')!.shadowRoot!.querySelector(
              '#result>raw-text',
            )!.innerHTML,
          );
          const { scrollTop, scrollLeft, scrollHeight, scrollWidth } =
            event.detail;
          return {
            type: event.type,
            detail: {
              scrollTop,
              scrollLeft,
              scrollHeight,
              scrollWidth,
            },
          };
        });
        expect(eventDetails.type).toBe('scrolltoupper');
        expect(eventDetails.detail.scrollTop).not.toBe(undefined);
        expect(eventDetails.detail.scrollLeft).not.toBe(undefined);
        expect(eventDetails.detail.scrollHeight).not.toBe(undefined);
        expect(eventDetails.detail.scrollWidth).not.toBe(undefined);
      });

      test('basic-element-scroll-view-event-scrolltolower', async ({
        page,
        browserName,
        context,
      }, { title }) => {
        test.skip(browserName !== 'chromium', 'not supoort CDPsession');
        await goto(page, title);
        const cdpSession = await context.newCDPSession(page);
        await swipe(cdpSession, {
          x: 100,
          y: 500,
          xDistance: 0,
          yDistance: -450,
        });
        await wait(100);
        await swipe(cdpSession, {
          x: 100,
          y: 500,
          xDistance: 0,
          yDistance: -450,
        });
        await wait(100);
        const eventDetails = await page.evaluate(() => {
          const event = JSON.parse(
            document.querySelector('lynx-view')!.shadowRoot!.querySelector(
              '#result>raw-text',
            )!.innerHTML,
          );
          const { scrollTop, scrollLeft, scrollHeight, scrollWidth } =
            event.detail;
          return {
            type: event.type,
            detail: {
              scrollTop,
              scrollLeft,
              scrollHeight,
              scrollWidth,
            },
          };
        });
        expect(eventDetails.type).toBe('scrolltolower');
        expect(eventDetails.detail.scrollTop).not.toBe(undefined);
        expect(eventDetails.detail.scrollLeft).not.toBe(undefined);
        expect(eventDetails.detail.scrollHeight).not.toBe(undefined);
        expect(eventDetails.detail.scrollWidth).not.toBe(undefined);
      });

      test(
        'basic-element-scroll-view-scroll-to-index',
        async ({ page }, { title }) => {
          await goto(page, title);
          await diffScreenShot(page, title, 'green-blue');
        },
      );
    });
    test.describe('x-viewpager-ng', () => {
      const elementName = 'x-viewpager-ng';
      test('basic-element-x-viewpager-ng-allow-horizontal-gesture', async ({
        page,
        browserName,
        context,
      }, { title }) => {
        test.skip(browserName !== 'chromium', 'cannot swipe');
        await goto(page, title);
        await wait(100);
        await diffScreenShot(
          page,
          elementName,
          title,
          'initial',
        );
        const cdpSession = await context.newCDPSession(page);
        await swipe(cdpSession, {
          x: 100,
          y: 50,
          xDistance: 200,
          yDistance: 0,
        });
        await diffScreenShot(
          page,
          elementName,
          title,
          'swipe-not-change',
        );
      });
      test(
        'basic-element-x-viewpager-ng-bindchange',
        async ({ page, browserName, context }, {
          title,
        }) => {
          test.skip(browserName !== 'chromium', 'cannot swipe');
          await goto(page, title);
          await wait(100);
          const cdpSession = await context.newCDPSession(page);
          const eventDetails: any[] = [];
          page.on('console', async (msg) => {
            eventDetails.push(await msg.args()[0]!.jsonValue());
          });
          await swipe(cdpSession, {
            x: 300,
            y: 50,
            xDistance: -250,
            yDistance: 0,
          });
          await wait(1000);
          const lastEvent = eventDetails.pop();
          expect(lastEvent.index).toBe(1);
          expect(lastEvent.isDragged).not.toBe(undefined);
        },
      );
      test('basic-element-x-viewpager-ng-bindoffsetchange', async ({
        page,
        browserName,
        context,
      }, { title }) => {
        test.skip(browserName !== 'chromium', 'cannot swipe');
        await wait(100);
        await goto(page, title);
        await wait(100);
        const cdpSession = await context.newCDPSession(page);
        const offsets: any[] = [];
        page.on('console', async (msg) => {
          offsets.push(offsets);
        });
        await swipe(cdpSession, {
          x: 300,
          y: 50,
          xDistance: -250,
          yDistance: 0,
        });
        await wait(1000);

        expect(offsets.length).toBeGreaterThan(0);
      });
      test(
        'basic-element-x-viewpager-ng-exposure',
        async ({ page, browserName, context }, {
          title,
        }) => {
          test.skip(browserName !== 'chromium', 'cannot swipe');
          await goto(page, title);
          await wait(100);
          const cdpSession = await context.newCDPSession(page);
          await swipe(cdpSession, {
            x: 300,
            y: 200,
            xDistance: -200,
            yDistance: 0,
          });
          await wait(1000);
          await diffScreenShot(page, elementName, title, 'exposure-1');
          await swipe(cdpSession, {
            x: 50,
            y: 200,
            xDistance: 200,
            yDistance: 0,
          });
          await wait(1000);
          await diffScreenShot(page, elementName, title, 'exposure-2');
        },
      );
      test(
        'basic-element-x-viewpager-ng-method-selecttab',
        async ({ page }, { title }) => {
          await goto(page, title);
          await wait(100);
          await diffScreenShot(
            page,
            elementName,
            title,
            'initial',
          );
          await page.locator('x-viewpager-ng').click();
          await diffScreenShot(
            page,
            elementName,
            title,
            'selecttab-1-green',
          );
        },
      );
      test(
        'basic-element-x-viewpager-ng-select-index',
        async ({ page }, { title }) => {
          await goto(page, title);
          await diffScreenShot(
            page,
            elementName,
            title,
            'select-index',
          );
          await page.evaluateHandle(() => {
            document.querySelector('lynx-view')!.shadowRoot!.querySelector(
              'x-viewpager-ng',
            )?.setAttribute(
              'select-index',
              '3',
            );
          });
          await wait(1000);
          await diffScreenShot(
            page,
            elementName,
            title,
            'select-index-change',
          );
        },
      );
      test(
        'basic-element-x-viewpager-ng-item-position-absolute',
        async ({ page }, { title }) => {
          await goto(page, title);
          await diffScreenShot(
            page,
            elementName,
            title,
            'select-index',
          );
        },
      );
      test(
        'basic-element-x-viewpager-ng-bindchange-select-tab',
        async ({ page, browserName }, { title }) => {
          let changeCalledCount = 0;
          let currentIndex = 0;
          await page.on('console', async (msg) => {
            const event = await msg.args()[0]?.evaluate((e) => {
              return {
                type: e.type,
                current: e.detail?.index,
              };
            });
            if (!event) {
              return;
            }
            if (event.type === 'change') {
              changeCalledCount++;
              currentIndex = event.current;
            }
          });
          await goto(page, title);
          await wait(1000);

          await page.getByTestId('last').click();
          await wait(1000);
          expect(changeCalledCount).toBe(1);
          if (browserName !== 'webkit') {
            expect(currentIndex).toBe(5);
          }
          await page.getByTestId('first').click();
          await wait(1000);
          expect(changeCalledCount).toBe(2);
          if (browserName !== 'webkit') {
            expect(currentIndex).toBe(0);
          }
        },
      );
    });

    test.describe('x-input', () => {
      // input/placeholder test-case start
      test('basic-element-x-input-placeholder', async ({ page }, { title }) => {
        await goto(page, title);
        await wait(100);
        await diffScreenShot(page, 'x-input', 'placeholder');
      });
      // input/placeholder test-case end

      // input/type test-case start
      test('basic-element-x-input-type', async ({ page }, { title }) => {
        await goto(page, title);
        await wait(100);
        await diffScreenShot(page, 'x-input', 'type');
      });
      // input/type test-case end

      // input/blur test-case start
      test('basic-element-x-input-blur', async ({ page }, { title }) => {
        await goto(page, title);
        await page.locator('.blur').click();
        await wait(100);
        const result = await page.locator('.result').first().innerText();
        await diffScreenShot(page, 'x-input', 'blur');
      });
      // input/blur test-case end

      // input/focus test-case start
      test(
        'basic-element-x-input-focus',
        async ({ page, browserName }, { title }) => {
          test.skip(browserName === 'firefox', 'flaky');
          await goto(page, title);
          await page.locator('.focus').click({ force: true });
          await wait(100);
          const result = await page.locator('.result').first().innerText();
          expect(result).toBe('bindfocus');
        },
      );
      // input/focus test-case end

      // input/bindfocus test-case start
      test('basic-element-x-input-bindfocus', async ({ page }, { title }) => {
        await goto(page, title);
        await page.locator('input').click({ force: true });
        await wait(100);
        const result = await page.locator('.result').first().innerText();
        expect(result).toBe('bindfocus');
      });
      // input/bindfocus test-case end

      // input/bindconfirm test-case start
      test('basic-element-x-input-bindconfirm', async ({ page }, { title }) => {
        await goto(page, title);
        await page.locator('input').press('Enter');
        await wait(100);
        const result = await page.locator('.result').first().innerText();
        expect(result).toBe('bindconfirm');
      });
      // input/bindconfirm test-case end

      // input/bindinput test-case start
      test('basic-element-x-input-bindinput', async ({ page }, { title }) => {
        await goto(page, title);
        await page.locator('input').press('Enter');
        await wait(100);
        await page.locator('input').fill('foobar');
        const result = await page.locator('.result').first().innerText();
        expect(result).toBe('foobar');
      });
      // input/bindinput test-case end
    });
    test.describe('x-overlay-ng', () => {
      test('basic-element-x-overlay-ng-demo', async ({ page }, { title }) => {
        await goto(page, title);
        await wait(200);
        await diffScreenShot(page, 'x-overlay-ng/demo', '', 'inital');
        await wait(100);
        await page.mouse.click(10, 10);
        await wait(100);
        await diffScreenShot(page, 'x-overlay-ng/demo', '', 'show-dialog');
        await wait(100);
        await page.mouse.click(200, 50);
        await wait(100);
        await diffScreenShot(
          page,
          'x-overlay-ng/demo',
          '',
          'click-wrapper-dom-hide-dialog',
        );
      });
      test(
        'basic-element-x-overlay-ng-playground-test-1',
        async ({ page }) => {
          await goto(page, 'basic-element-x-overlay-ng-playground-test');
          await wait(200);
          await page.locator('#toggleModal1').click();
          await wait(50);
          await diffScreenShot(
            page,
            'x-overlay-ng/playground-test-1',
            '',
            'click-button-1',
            {
              clip: {
                x: 0,
                y: 0,
                width: 500,
                height: 300,
              },
            },
          );
          await page.mouse.click(63, 200);
          await wait(50);
          await diffScreenShot(
            page,
            'x-overlay-ng/playground-test-1',
            '',
            'click-overlay-content-do-not-through',
            {
              clip: {
                x: 0,
                y: 0,
                width: 500,
                height: 300,
              },
            },
          );
          await page.mouse.click(300, 200);
          await wait(50);
          await diffScreenShot(
            page,
            'x-overlay-ng/playground-test-1',
            '',
            'click-overlay-out-of-content-to-trigger-bottom-button',
            {
              clip: {
                x: 0,
                y: 0,
                width: 500,
                height: 300,
              },
            },
          );
          expect(
            await page.getByText('on Show').count(),
            'to have one on show event',
          ).toBe(1);
        },
      );
      test(
        'basic-element-x-overlay-ng-playground-test-2',
        async ({ page, browserName }) => {
          await goto(page, 'basic-element-x-overlay-ng-playground-test');
          await wait(200);
          await page.locator('#toggleModal2').click();
          await wait(50);
          await diffScreenShot(
            page,
            'x-overlay-ng/playground-test-2',
            '',
            'click-button-2',
          );
          if (browserName === 'webkit') {
            await page.mouse.click(40, 600);
            await wait(50);
          } else {
            await page.mouse.click(20, 700);
            await wait(50);
          }
          await diffScreenShot(
            page,
            'x-overlay-ng/playground-test-2',
            '',
            'click-close-button-in-overlay',
            {
              clip: {
                x: 0,
                y: 0,
                width: 200,
                height: 100,
              },
            },
          );
        },
      );
      test(
        'basic-element-x-overlay-ng-playground-test-3',
        async ({ page, browserName }) => {
          await goto(page, 'basic-element-x-overlay-ng-playground-test');
          await wait(200);
          await page.locator('#toggleModal3').click();
          await wait(50);
          await diffScreenShot(
            page,
            'x-overlay-ng/playground-test-3',
            '',
            'click-button-3',
            {
              clip: {
                x: 0,
                y: 450,
                width: 100,
                height: 100,
              },
            },
          );
          await page.mouse.click(100, 400); // click backdrop
          await wait(50);
          expect(
            await page.getByText('on Show').count(),
            'to have one on show event',
          ).toBe(1);
          expect(
            await page.getByText('on dismiss').count(),
            'to have one on dismiss event',
          ).toBe(1);
        },
      );
      test('basic-element-x-overlay-ng-playground-test-4-has-backdrop', async ({ page, browserName }) => {
        await goto(page, 'basic-element-x-overlay-ng-playground-test');
        await page.mouse.click(0, 0); // webkit needs this
        await wait(200);
        await page.locator('#toggleModal4').click({ force: true });
        await wait(50);
        await diffScreenShot(
          page,
          'x-overlay-ng/playground-test-4-has-backdrop',
          '',
          'click-button-4',
          {
            clip: {
              x: 0,
              y: 0,
              width: 100,
              height: 100,
            },
          },
        );
        await page.mouse.click(100, 330);
        await wait(100);
        await diffScreenShot(
          page,
          'x-overlay-ng/playground-test-4-has-backdrop',
          '',
          'click-button-4-again-will-handle-by-backdrop',
          {
            clip: {
              x: 0,
              y: 0,
              width: 100,
              height: 100,
            },
          },
        );
        await page.mouse.click(50, 50);
        await wait(50);
        await diffScreenShot(
          page,
          'x-overlay-ng/playground-test-4-has-backdrop',
          '',
          'click-close-button-to-close-overlay',
          {
            clip: {
              x: 0,
              y: 0,
              width: 100,
              height: 100,
            },
          },
        );
      });
      test(
        'basic-element-x-overlay-ng-counter-test2-could-show-all',
        async ({ page, browserName }, {
          title,
        }) => {
          test.skip(browserName === 'webkit', 'flaky');
          await goto(page, 'basic-element-x-overlay-ng-counter-test2');
          await wait(200);
          // y position
          const close = 350;
          const btn0 = 400;
          const btn1 = 450;
          const btn2 = 500;
          const btn3 = 550;
          for (const btnY of [btn0, btn1, btn2, btn3]) {
            await wait(100);
            await page.mouse.click(300, btnY);
          }
          await wait(1500);
          await diffScreenShot(
            page,
            'x-overlay-ng/counter-test2-could-show-all',
            '',
            'could-open-all-4',
            {
              clip: {
                x: 0,
                y: 260,
                width: 300,
                height: 200,
              },
            },
          );
          await page.mouse.click(300, close);
          await wait(1500);
          await diffScreenShot(
            page,
            'x-overlay-ng/counter-test2-could-show-all',
            '',
            'could-close-all-4',
            {
              clip: {
                x: 0,
                y: 300,
                width: 15,
                height: 200,
              },
              maxDiffPixelRatio: 0,
            },
          );
        },
      );
      test(
        'basic-element-x-overlay-ng-counter-test2-event-correct',
        async ({ page, browserName }, {
          title,
        }) => {
          test.skip(browserName === 'webkit', 'blank view');
          await goto(page, 'basic-element-x-overlay-ng-counter-test2');
          await wait(200);
          await wait(300);
          // y position
          const close = 350;
          const btn0 = 380;
          const btn1 = 450;
          const btn2 = 500;
          const btn3 = 550;

          await page.mouse.click(300, btn0);
          await wait(50);
          await page.mouse.click(50, 300);
          await wait(50);
          await page.mouse.click(300, btn0);
          await wait(50);
          expect(await page.getByText('目前计数为 1').count()).toBe(1);

          await page.mouse.click(300, btn1);
          await wait(50);
          await page.mouse.click(50, 300);
          await wait(50);
          await page.mouse.click(300, btn1);
          await wait(50);
          expect(await page.getByText('目前计数为 3').count()).toBe(1);

          await page.mouse.click(300, btn2);
          await wait(50);
          await page.mouse.click(50, 300);
          await wait(50);
          await page.mouse.click(300, btn2);
          await wait(50);
          expect(await page.getByText('目前计数为 6').count()).toBe(1);

          await page.mouse.click(300, btn3);
          await wait(50);
          await page.mouse.click(50, 270);
          await wait(50);
          await page.mouse.click(300, btn3);
          await wait(50);
          expect(await page.getByText('目前计数为 10').count()).toBe(1);
        },
      );
    });
    test.describe('x-refresh-view', () => {
      test(
        'basic-element-x-refresh-view-demo',
        async ({ page, browserName, context }, {
          title,
        }) => {
          test.skip(browserName !== 'chromium');
          await goto(page, title);
          await wait(500);
          await diffScreenShot(page, 'x-refresh-view/demo', 'initial');
          if (browserName === 'webkit') return; // cannot wheel;
          // pull down to load
          const cdpSession = await context.newCDPSession(page);
          let touchRelease = await dragAndHold(cdpSession, {
            x: 200,
            y: 500,
            xDistance: 0,
            yDistance: 100,
          });
          await diffScreenShot(page, 'x-refresh-view/demo', 'pull-down');
          await touchRelease();
          await wait(2000);
          await diffScreenShot(page, 'x-refresh-view/demo', 'pull-down-loaded');
          await wait(100);
          // pull up to load more
          touchRelease = await dragAndHold(cdpSession, {
            x: 200,
            y: 600,
            xDistance: 0,
            yDistance: -200,
          });
          await diffScreenShot(
            page,
            'x-refresh-view/demo',
            'pull-up',
            'index',
            {
              fullPage: true,
            },
          );
          await touchRelease();
          await wait(2000);
          await diffScreenShot(page, 'x-refresh-view/demo', 'pull-up-loaded');
        },
      );
    });
    test.describe('x-swiper', () => {
      test(
        'basic-element-x-swiper-indicator-dots',
        async ({ page }, { title }) => {
          await goto(page, title);
          await wait(100);
          await diffScreenShot(page, 'x-swiper', 'indicator-dots', 'index', {
            animations: 'allow',
            fullPage: true,
          });
        },
      );
      test(
        'basic-element-x-swiper-indicator-color',
        async ({ page }, { title }) => {
          await goto(page, title);
          await wait(100);
          await diffScreenShot(page, 'x-swiper', 'indicator-color', undefined, {
            animations: 'allow',
          });
        },
      );
      test('basic-element-x-swiper-current', async ({ page }, { title }) => {
        await goto(page, title);
        await wait(100);
        await diffScreenShot(page, 'x-swiper', 'current-0', undefined, {
          animations: 'allow',
        });
        await page.getByTestId('swiper-1').click();
        // default duration is 500ms, add 100ms buffer time
        await wait(600);
        await diffScreenShot(page, 'x-swiper', 'current-1', undefined, {
          animations: 'allow',
        });
        await page.getByTestId('swiper-1').click();
        await wait(600);
        await diffScreenShot(page, 'x-swiper', 'current-2', undefined, {
          animations: 'allow',
        });
        await page.getByTestId('swiper-1').click();
        await wait(600);
        await diffScreenShot(page, 'x-swiper', 'current-3', undefined, {
          animations: 'allow',
        });
        await page.getByTestId('swiper-1').click();
        await wait(600);
        await diffScreenShot(page, 'x-swiper', 'current-4', undefined, {
          animations: 'allow',
        });
      });
      test(
        'basic-element-x-swiper-mode-normal',
        async ({ page }, { title }) => {
          await goto(page, title);
          await wait(100);
          await diffScreenShot(page, 'x-swiper', 'mode-normal', undefined, {
            animations: 'allow',
          });
          await page.getByTestId('normal').click();
          await wait(500);
          await diffScreenShot(
            page,
            'x-swiper',
            'mode-normal-last-child',
            undefined,
            { animations: 'allow' },
          );
        },
      );
      test(
        'basic-element-x-swiper-mode-carousel',
        async ({ page }, { title }) => {
          await goto(page, title);
          await wait(100);
          await diffScreenShot(page, 'x-swiper', 'mode-carousel', undefined, {
            animations: 'allow',
          });
          await page.getByTestId('carousel').click();
          await wait(500);
          await diffScreenShot(
            page,
            'x-swiper',
            'mode-carousel-last-child',
            undefined,
            { animations: 'allow' },
          );
        },
      );
      test(
        'basic-element-x-swiper-mode-coverflow',
        async ({ page, browserName }, { title }) => {
          test.skip(
            browserName !== 'chromium',
            'do not support scroll-driven-animation',
          );
          await goto(page, title);
          await wait(200);
          await diffScreenShot(page, 'x-swiper', 'mode-coverflow', undefined, {
            animations: 'allow',
          });
          await page.getByTestId('coverflow').click();
          await wait(1000);
          await diffScreenShot(
            page,
            'x-swiper',
            'mode-coverflow-last-child',
            undefined,
            { animations: 'allow' },
          );
        },
      );
      test(
        'basic-element-x-swiper-mode-flat-coverflow',
        async ({ page }, { title }) => {
          await goto(page, title);
          await wait(100);
          await diffScreenShot(
            page,
            'x-swiper',
            'mode-flat-coverflow',
            undefined,
            { animations: 'allow' },
          );
          await page.getByTestId('flat-coverflow').click();
          await wait(1000);
          await diffScreenShot(
            page,
            'x-swiper',
            'mode-flat-coverflow-last-child',
            undefined,
            { animations: 'allow' },
          );
        },
      );
      test(
        'basic-element-x-swiper-mode-carry',
        async ({ page, browserName, context }, { title }) => {
          await goto(page, title);
          await wait(100);
          await diffScreenShot(page, 'x-swiper', 'mode-carry', undefined, {
            animations: 'allow',
          });
          test.skip(browserName !== 'chromium', 'do not support cdp session');
          const cdpSession = await context.newCDPSession(page);
          await dragAndHold(cdpSession, {
            x: 300,
            y: 50,
            xDistance: -250,
            yDistance: 0,
          });
          await diffScreenShot(
            page,
            'x-swiper',
            'mode-carry-inter-state',
            undefined,
            { animations: 'allow' },
          );
        },
      );
      test(
        'basic-element-x-swiper-swiper-dynamic',
        async ({ page }, { title }) => {
          await goto(page, title);
          await wait(100);
          await diffScreenShot(
            page,
            'x-swiper',
            'dynamic-status-0',
            undefined,
            {
              animations: 'allow',
            },
          );
          await page.getByTestId('swiper-1').click();
          await wait(500);
          await diffScreenShot(
            page,
            'x-swiper',
            'dynamic-status-1',
            undefined,
            {
              animations: 'allow',
            },
          );
          await page.getByTestId('swiper-1').click();
          await wait(500);
          await diffScreenShot(
            page,
            'x-swiper',
            'dynamic-status-2',
            undefined,
            {
              animations: 'allow',
            },
          );
          await page.getByTestId('swiper-0').click();
          await wait(500);
          await diffScreenShot(
            page,
            'x-swiper',
            'dynamic-status-3',
            undefined,
            {
              animations: 'allow',
            },
          );
          await page.getByTestId('swiper-0').click();
          await wait(500);
          await diffScreenShot(
            page,
            'x-swiper',
            'dynamic-status-4',
            undefined,
            {
              animations: 'allow',
            },
          );
        },
      );
      test('basic-element-x-swiper-duration', async ({ page }, { title }) => {
        await goto(page, title);
        await wait(100);
        await page.getByTestId('swiper-1').click();
        // custom duration is 200ms, add 100ms tolerance
        await wait(300);
        await diffScreenShot(page, 'x-swiper', 'duration', 'current-1', {
          animations: 'allow',
        });
        await page.getByTestId('swiper-1').click();
        await wait(300);
        await diffScreenShot(page, 'x-swiper', 'duration', 'current-2', {
          animations: 'allow',
        });
        await page.getByTestId('duration-100').click();
        await page.getByTestId('swiper-1').click();
        await wait(200);
        await diffScreenShot(page, 'x-swiper', 'duration', 'current-3', {
          animations: 'allow',
        });
        await page.getByTestId('swiper-1').click();
        await wait(200);
        await diffScreenShot(page, 'x-swiper', 'duration', 'current-4', {
          animations: 'allow',
        });
      });
      test('basic-element-x-swiper-autoplay', async ({ page }, { title }) => {
        await goto(page, title);
        // default duration: 500, interval: 5000
        await wait(5600);
        await diffScreenShot(page, 'x-swiper', 'autoplay-5', undefined, {
          animations: 'allow',
        });
        await page.getByTestId('autoplay').click();
        await wait(5600);
        await diffScreenShot(page, 'x-swiper', 'autoplay-10', undefined, {
          animations: 'allow',
        });
        await wait(5600);
        await diffScreenShot(page, 'x-swiper', 'autoplay-15', undefined, {
          animations: 'allow',
        });
        await page.getByTestId('autoplay').click();
        await wait(5500);
        await diffScreenShot(page, 'x-swiper', 'autoplay-20', undefined, {
          animations: 'allow',
        });
      });
      test(
        'basic-element-x-swiper-interval',
        async ({ page, browserName }, { title }) => {
          test.skip(
            browserName === 'firefox',
            'diffScreenShot cost too long time in firefox',
          );
          await goto(page, title);
          await wait(5600);
          await diffScreenShot(page, 'x-swiper', 'interval-1', undefined, {
            animations: 'allow',
          });
          await page.getByTestId('interval-1000').click();
          await wait(1600);
          await diffScreenShot(page, 'x-swiper', 'interval-2', undefined, {
            animations: 'allow',
          });
          await page.getByTestId('interval-0').click();
          await wait(600);
          await diffScreenShot(page, 'x-swiper', 'interval-3', undefined, {
            animations: 'allow',
          });
        },
      );
      test(
        'basic-element-x-swiper-circular-normal',
        async ({ page, browserName }, { title }) => {
          await goto(page, title);
          await wait(1000);
          await diffScreenShot(page, 'x-swiper', 'circular/normal', 'index');
          await page.getByTestId('next').click();
          await wait(2000);
          await diffScreenShot(page, 'x-swiper', 'circular/normal', 'index-1');
          await page.getByTestId('next').click();
          await wait(2000);
          await diffScreenShot(page, 'x-swiper', 'circular/normal', 'index-2');
          await page.getByTestId('next').click();
          await wait(2000);
          await diffScreenShot(page, 'x-swiper', 'circular/normal', 'index-3');
          await page.getByTestId('next').click();
          await wait(2000);
          await diffScreenShot(page, 'x-swiper', 'circular/normal', 'index-0');
        },
      );
      test(
        'basic-element-x-swiper-circular-carousel',
        async ({ page, browserName }, { title }) => {
          await goto(page, title);
          await wait(1000);
          await diffScreenShot(page, 'x-swiper', 'circular/carousel', 'index');
          await page.getByTestId('next').click();
          await wait(2000);
          await diffScreenShot(
            page,
            'x-swiper',
            'circular/carousel',
            'index-1',
          );
          await page.getByTestId('next').click();
          await wait(2000);
          await diffScreenShot(
            page,
            'x-swiper',
            'circular/carousel',
            'index-2',
          );
          await page.getByTestId('next').click();
          await wait(2000);
          await diffScreenShot(
            page,
            'x-swiper',
            'circular/carousel',
            'index-3',
          );
          await page.getByTestId('next').click();
          await wait(2000);
          await diffScreenShot(
            page,
            'x-swiper',
            'circular/carousel',
            'index-0',
          );
        },
      );
      test(
        'basic-element-x-swiper-circular-coverflow',
        async ({ page, browserName }, { title }) => {
          test.skip(browserName !== 'chromium');
          await goto(page, title);
          await wait(1000);
          await diffScreenShot(page, 'x-swiper', 'circular/coverflow', 'index');
          await page.getByTestId('next').click();
          await wait(2000);
          await diffScreenShot(
            page,
            'x-swiper',
            'circular/coverflow',
            'index-1',
          );
          await page.getByTestId('next').click();
          await wait(2000);
          await diffScreenShot(
            page,
            'x-swiper',
            'circular/coverflow',
            'index-2',
          );
          await page.getByTestId('next').click();
          await wait(2000);
          await diffScreenShot(
            page,
            'x-swiper',
            'circular/coverflow',
            'index-3',
          );
          await page.getByTestId('next').click();
          await wait(2000);
          await diffScreenShot(
            page,
            'x-swiper',
            'circular/coverflow',
            'index-0',
          );
        },
      );
      test(
        'basic-element-x-swiper-circular-flat-coverflow',
        async ({ page, browserName }, { title }) => {
          await goto(page, title);
          await wait(1000);
          await diffScreenShot(
            page,
            'x-swiper',
            'circular/flat-coverflow',
            'index',
          );
          await page.getByTestId('next').click();
          await wait(2000);
          await diffScreenShot(
            page,
            'x-swiper',
            'circular/flat-coverflow',
            'index-1',
          );
          await page.getByTestId('next').click();
          await wait(2000);
          await diffScreenShot(
            page,
            'x-swiper',
            'circular/flat-coverflow',
            'index-2',
          );
          await page.getByTestId('next').click();
          await wait(2000);
          await diffScreenShot(
            page,
            'x-swiper',
            'circular/flat-coverflow',
            'index-3',
          );
          await page.getByTestId('next').click();
          await wait(2000);
          await diffScreenShot(
            page,
            'x-swiper',
            'circular/flat-coverflow',
            'index-0',
          );
        },
      );
      test(
        'basic-element-x-swiper-circular-carry',
        async ({ page, browserName }, { title }) => {
          await goto(page, title);
          await wait(1000);
          await diffScreenShot(page, 'x-swiper', 'circular/carry', 'index');
          await page.getByTestId('next').click();
          await wait(2000);
          await diffScreenShot(page, 'x-swiper', 'circular/carry', 'index-1');
          await page.getByTestId('next').click();
          await wait(2000);
          await diffScreenShot(page, 'x-swiper', 'circular/carry', 'index-2');
          await page.getByTestId('next').click();
          await wait(2000);
          await diffScreenShot(page, 'x-swiper', 'circular/carry', 'index-3');
          await page.getByTestId('next').click();
          await wait(2000);
          await diffScreenShot(page, 'x-swiper', 'circular/carry', 'index-0');
        },
      );
      test(
        'basic-element-x-swiper-page-margin',
        async ({ page, browserName }, { title }) => {
          test.skip(browserName === 'webkit', 'flaky');
          await goto(page, title);
          await wait(100);
          await diffScreenShot(page, 'x-swiper', 'page-margin', 'index', {
            fullPage: true,
            animations: 'allow',
          });
          await page.getByTestId('next').click();
          await wait(600);
          await diffScreenShot(page, 'x-swiper', 'page-margin-1', 'index', {
            fullPage: true,
            animations: 'allow',
          });
        },
      );
      test(
        'basic-element-x-swiper-vertical',
        async ({ page, browserName }, { title }) => {
          test.skip(browserName === 'webkit', 'scroll driven animation');
          await goto(page, title);
          await wait(100);
          await diffScreenShot(
            page,
            'x-swiper',
            'vertical/current-0',
            'index',
            {
              fullPage: true,
              animations: 'allow',
            },
          );
          await page.getByTestId('next').click();
          await wait(600);
          await diffScreenShot(
            page,
            'x-swiper',
            'vertical/current-1',
            'index',
            {
              fullPage: true,
              animations: 'allow',
            },
          );
        },
      );
      test(
        'basic-element-x-swiper-bindchange',
        async ({ page, browserName, context }, { title }) => {
          await goto(page, title);
          const autoplay = [null, false, false, false];
          let manual = false;
          let programming = false;
          await page.on('console', async (msg) => {
            const event = await msg.args()[0]?.evaluate((e) => {
              return {
                type: e.type,
                dataset: { testid: e?.target?.dataset?.testid },
                detail: { current: e?.detail?.current },
              };
            });
            if (!event) return;
            if (
              event.type === 'change'
              && event.dataset.testid === 'autoplay'
            ) {
              autoplay[event.detail.current] = true;
            }

            if (
              event.type === 'change'
              && event.dataset.testid === 'manual'
            ) {
              manual = event.detail.current === 1;
            }

            if (
              event.type === 'change'
              && event.dataset.testid === 'programming'
            ) {
              programming = event.detail.current === 1;
            }
          });
          await page.getByTestId('next').click();
          await wait(6600);
          if (browserName === 'chromium') {
            const cdpSession = await context.newCDPSession(page);
            await swipe(cdpSession, {
              x: 300,
              y: 50,
              xDistance: -100,
              yDistance: 0,
            });
            await wait(1000);
          }

          // we may miss the first one
          expect(autoplay[2]).toBe(true);
          expect(autoplay[3]).toBe(true);
          expect(programming).toBe(true);
          if (browserName === 'chromium') {
            expect(manual).toBe(true);
          }
        },
      );
      test(
        'basic-element-x-swiper-bindscrollstart',
        async ({ page, browserName, context }, { title }) => {
          const autoplay = [false, false, false];
          let manual = false;
          let programming = false;
          await page.on('console', async (msg) => {
            const event = await msg.args()[0]?.evaluate((e) => ({
              type: e.type,
              dataset: { testid: e?.target?.dataset?.testid },
              detail: {
                current: e?.detail?.current,
                isDragged: e?.detail?.isDragged,
              },
            }));
            if (!event) return;
            if (
              event.type === 'scrollstart'
              && event.dataset.testid === 'autoplay'
              && event.detail.isDragged === false
            ) {
              autoplay[event.detail.current] = true;
            }

            if (
              event.type === 'scrollstart'
              && event.dataset.testid === 'manual'
              && event.detail.isDragged === true
            ) {
              manual = event.detail.current === 0;
            }

            if (
              event.type === 'scrollstart'
              && event.dataset.testid === 'programming'
              && event.detail.isDragged === false
            ) {
              programming = event.detail.current === 0;
            }
          });
          await goto(page, title);
          await wait(1000);
          await page.getByTestId('next').click();
          await wait(6600);
          if (browserName === 'chromium') {
            const cdpSession = await context.newCDPSession(page);
            await swipe(cdpSession, {
              x: 300,
              y: 50,
              xDistance: -200,
              yDistance: 0,
            });
            await wait(1000);
          }

          expect(autoplay[0] && autoplay[1] && autoplay[2]).toBe(true);
          expect(programming).toBe(true);
          if (browserName === 'chromium') {
            expect(manual).toBe(true);
          }
        },
      );
      test(
        'basic-element-x-swiper-bindscrollend',
        async ({ page, browserName, context }, { title }) => {
          await goto(page, title);
          const autoplay = [null, false, false, false];
          let manual = false;
          let programming = false;
          await page.on('console', async (msg) => {
            const event = await msg.args()[0]?.evaluate((e) => ({
              type: e.type,
              dataset: { testid: e?.target?.dataset?.testid },
              detail: {
                current: e?.detail?.current,
              },
            }));
            if (!event) return;
            if (
              event.type === 'scrollend'
              && event.dataset.testid === 'autoplay'
            ) {
              autoplay[event.detail.current] = true;
            }

            if (
              event.type === 'scrollend' && event.dataset.testid === 'manual'
            ) {
              manual = true;
            }

            if (
              event.type === 'scrollend'
              && event.dataset.testid === 'programming'
            ) {
              programming = event.detail.current === 1;
            }
          });
          await page.getByTestId('next').click();
          await wait(6600);
          if (browserName === 'chromium') {
            const cdpSession = await context.newCDPSession(page);
            await swipe(cdpSession, {
              x: 300,
              y: 50,
              xDistance: -200,
              yDistance: 0,
            });
            await wait(1000);
          }
          // we may miss the first one
          expect(autoplay[2]).toBe(true);
          expect(autoplay[3]).toBe(true);
          expect(programming).toBe(true);
          if (browserName === 'chromium') {
            expect(manual).toBe(true);
          }
        },
      );
    });

    test.describe('x-textarea', () => {
      // x-textarea/disabled test-case start
      test('basic-element-x-textarea-disabled', async ({ page }, { title }) => {
        await goto(page, title);
        await wait(100);
        await diffScreenShot(page, 'x-textarea', 'disabled/default', 'index', {
          fullPage: true,
          maxDiffPixelRatio: 0.02,
        });
        await page.locator('.block').first().click();
        await diffScreenShot(page, 'x-textarea', 'disabled/true', 'index', {
          fullPage: true,
        });
        await page.locator('.block').first().click();
        await diffScreenShot(page, 'x-textarea', 'disabled/false', 'index', {
          fullPage: true,
          maxDiffPixelRatio: 0.02,
        });
      });
      // x-textarea/focus test-case end

      // x-textarea/maxlength test-case start
      test(
        'basic-element-x-textarea-maxlength',
        async ({ page }, { title }) => {
          await goto(page, title);
          await wait(100);
          await diffScreenShot(
            page,
            'x-textarea',
            'maxlength/default',
            'index',
            {
              maxDiffPixelRatio: 0.02,
            },
          );
          await page.getByTestId('setValue').click();
          await page.getByTestId('setLength').click();
          await page.getByTestId('setValueLength').click();
          await page.getByTestId('setLengthValue').click();
          await page.getByTestId('setLengthAndValue').click();
          await page.getByTestId('setValueAndLength').click();
          await diffScreenShot(
            page,
            'x-textarea',
            'maxlength/dynamic',
            'index',
            {
              maxDiffPixelRatio: 0.02,
            },
          );
        },
      );
      // x-textarea/maxlength test-case end

      // x-textarea/maxlines test-case start
      test('basic-element-x-textarea-maxlines', async ({ page }, { title }) => {
        await goto(page, title);
        await wait(100);
        await diffScreenShot(
          page,
          'x-textarea',
          'maxlines/init-value',
          'index',
          {
            maxDiffPixelRatio: 0.02,
          },
        );
        await page.getByTestId('setValue').click();
        await diffScreenShot(
          page,
          'x-textarea',
          'maxlines/update-value',
          'index',
          {
            maxDiffPixelRatio: 0.02,
          },
        );
      });
      // x-textarea/maxlines test-case end

      // x-textarea/min-height-max-height test-case start
      test(
        'basic-element-x-textarea-min-height-max-height',
        async ({ page }, { title }) => {
          await goto(page, title);
          await wait(100);
          await diffScreenShot(
            page,
            'x-textarea',
            'min-height-max-height/min-height',
            'index',
            {
              maxDiffPixelRatio: 0.02,
            },
          );
          await page.getByTestId('setValue').click();
          await diffScreenShot(
            page,
            'x-textarea',
            'min-height-max-height/max-height',
            'index',
            {
              maxDiffPixelRatio: 0.02,
            },
          );
        },
      );
      // x-textarea/min-height-max-height test-case end

      // x-textarea/placeholder test-case start
      test(
        'basic-element-x-textarea-placeholder',
        async ({ page }, { title }) => {
          await goto(page, title);
          await wait(100);
          await diffScreenShot(
            page,
            'x-textarea',
            'placeholder/init-value',
            'index',
            {
              maxDiffPixelRatio: 0.02,
            },
          );
          await page.locator('.block').first().click();
          await diffScreenShot(
            page,
            'x-textarea',
            'placeholder/update-value',
            'index',
            {
              maxDiffPixelRatio: 0.02,
            },
          );
        },
      );
      // x-textarea/placeholder test-case end

      // x-textarea/placeholder-style test-case start
      test(
        'basic-element-x-textarea-placeholder-style',
        async ({ page }, { title }) => {
          await goto(page, title);
          await wait(100);
          await diffScreenShot(
            page,
            'x-textarea',
            'placeholder-style/init-value',
            'index',
            {
              maxDiffPixelRatio: 0.02,
            },
          );
          await page.locator('.block').first().click();
          await diffScreenShot(
            page,
            'x-textarea',
            'placeholder-style/update-value',
            'index',
            {
              maxDiffPixelRatio: 0.02,
            },
          );
        },
      );
      // x-textarea/placeholder-style test-case end

      // x-textarea/bindinput test-case start
      test(
        'basic-element-x-textarea-bindinput',
        async ({ page }, { title }) => {
          await goto(page, title);
          let bindfocus = false;
          let bindblur = false;
          let bindinput = false;
          page.on('console', async (msg) => {
            const event = await msg.args()[0]?.jsonValue();
            if (typeof event !== 'object') return;
            // NOTE: dataset is not included in the previous json value, so we should
            // manually find it from the JSHandle.
            const dataset = await (
              await (await msg.args()[0]!.getProperty('target')).getProperty(
                'dataset',
              )
            ).jsonValue();
            if (
              event.type === 'focus'
              && dataset.testid === 'textarea'
              && event.detail.value === ''
            ) {
              bindfocus = true;
            }

            if (
              event.type === 'blur'
              && dataset.testid === 'textarea'
              && event.detail.value === ''
            ) {
              bindblur = true;
            }

            if (
              event.type === 'input'
              && dataset.testid === 'textarea'
              && event.detail.value === 'value'
            ) {
              bindinput = true;
            }
          });
          await wait(100);
          await page.locator('textarea')?.click({ force: true });
          await wait(50);
          await page.locator('textarea')?.blur();
          await wait(50);
          await page.locator('textarea')?.fill('value');
          await wait(100);
          expect(bindblur).toBeTruthy();
          expect(bindfocus).toBeTruthy();
          expect(bindinput).toBeTruthy();
        },
      );
      // x-textarea/bindinput test-case end
    });
    test.describe('x-audio-tt', () => {
      test('basic-element-x-audio-tt-play', async ({ page }, { title }) => {
        // test.skip(true, 'lynx.createSelectorQuery is not supported'); // FIXME
      });
    });

    test.describe('list', () => {
      const elementName = 'list';
      test(
        'basic-element-list-basic',
        async ({ page, browserName }, { title }) => {
          let scrolled = false;
          let scrollend = false;
          await page.on('console', async (msg) => {
            const event = await msg.args()[0]?.evaluate((e) => ({
              type: e.type,
            }));
            if (!event) return;
            if (event.type === 'scroll') {
              scrolled = true;
            }
            if (event.type === 'scrollend') {
              scrollend = true;
            }
          });

          await goto(page, title);
          await diffScreenShot(page, elementName, title);
          await page.evaluate(() => {
            document.querySelector('lynx-view')!.shadowRoot!.querySelector(
              'x-list',
            )?.shadowRoot?.querySelector(
              '#content',
            )
              ?.scrollTo(0, 500);
          });
          await wait(1000);
          expect(scrolled).toBeTruthy();
          expect(scrollend).toBeTruthy();
        },
      );

      test(
        'basic-element-list-scroll-to-position',
        async ({ page }, { title }) => {
          await goto(page, title);
          await diffScreenShot(page, elementName, title, 'initial');
          await wait(1000);
          await page.locator('#scrollToPosition').click();
          await diffScreenShot(page, elementName, title, 'scroll-to-position');
        },
      );
    });
  });

  test.describe('linear layout', () => {
    test('basic-linear-margin-not-collapse', async ({ page }, { title }) => {
      await goto(page, title);
      const boundingRact = await page.locator('#container').boundingBox();
      expect(boundingRact!.height).toEqual(360);
    });
    test('basic-linear-absolute-not-in-flow', async ({ page }, { title }) => {
      await goto(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('basic-linear-item-use-order', async ({ page }, { title }) => {
      await goto(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test.skip('linear-item-use-order-affect-z-layout', async ({ page }, {
      title,
    }) => {
      /**
       * FIXME: z-index issue
       */
      await goto(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('basic-linear-orientation-vertical-with-direction', async ({ page }, {
      title,
    }) => {
      await goto(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test(
      'basic-linear-orientation-horizontal-with-direction',
      async ({ page }, {
        title,
      }) => {
        await goto(page, title);
        await diffScreenShot(page, title, 'index');
      },
    );
    test('basic-linear-item-do-not-shrink', async ({ page }, { title }) => {
      await goto(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('basic-linear-weight-not-assign-full-free-space', async ({ page }, {
      title,
    }) => {
      await goto(page, title);
      await diffScreenShot(page, title, 'index');
      const boundingRact1 = await page.locator('#weight1').boundingBox();
      expect(boundingRact1!.width).toEqual(10);
      const boundingRact2 = await page.locator('#weight2').boundingBox();
      expect(boundingRact2!.width).toEqual(20);
    });
    test(
      'basic-linear-sum-of-item-weight-larger-than-container-weight-sum',
      async ({
        page,
      }, { title }) => {
        await goto(page, title);
        await diffScreenShot(page, title, 'index');
        const boundingRact1 = await page.locator('#weight1').boundingBox();
        expect(boundingRact1!.width).toEqual(20);
        const boundingRact2 = await page.locator('#weight2').boundingBox();
        expect(boundingRact2!.width).toEqual(40);
      },
    );
    test('basic-linear-weight-sum-equal-to-item-weigth', async ({ page }, {
      title,
    }) => {
      await goto(page, title);
      await diffScreenShot(page, title, 'index');
      const boundingRact1 = await page.locator('#weight1').boundingBox();
      expect(boundingRact1!.width).toEqual(20);
      const boundingRact2 = await page.locator('#weight2').boundingBox();
      expect(boundingRact2!.width).toEqual(40);
    });
    test('basic-linear-weight-sum-is-zero', async ({ page }, { title }) => {
      await goto(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('basic-linear-weight-sum-is-float', async ({ page }, { title }) => {
      await goto(page, title);
      const boundingRact1 = await page.locator('#weight0').boundingBox();
      expect(boundingRact1!.width).toEqual(100);
    });
    test(
      'basic-linear-weight-calced-less-than-size',
      async ({ page }, { title }) => {
        await goto(page, title);
        const boundingRact1 = await page.locator('#weight0').boundingBox();
        expect(boundingRact1!.width).toEqual(100);
      },
    );
    test('basic-linear-weight-calced-large-than-size', async ({ page }, {
      title,
    }) => {
      await goto(page, title);
      const boundingRact1 = await page.locator('#weight0').boundingBox();
      expect(boundingRact1!.width).toEqual(100);
    });
    test(
      'basic-linear-item-do-not-respond-to-flex',
      async ({ page }, { title }) => {
        await goto(page, title);
        await diffScreenShot(page, title, 'index');
      },
    );
    test('basic-linear-item-do-not-respond-to-flex-basis', async ({ page }, {
      title,
    }) => {
      await goto(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test(
      'basic-linear-row-container-main-axis-graverty-right-left-with-direction-rtl',
      async ({
        page,
      }, { title }) => {
        await goto(page, title);
        await diffScreenShot(page, title, 'index');
      },
    );
    test(
      'basic-linear-row-container-main-axis-justify-content-right-left-with-direction-rtl',
      async ({
        page,
      }, { title }) => {
        await goto(page, title);
        await diffScreenShot(page, title, 'index');
      },
    );
    test(
      'basic-linear-row-container-main-axis-justify-content-start-end-with-direction-rtl',
      async ({
        page,
      }, { title }) => {
        await goto(page, title);
        await diffScreenShot(page, title, 'index');
      },
    );
    test(
      'basic-linear-row-container-main-axis-graverty-top-bottom-with-direction-rtl',
      async ({
        page,
      }, { title }) => {
        await goto(page, title);
        await diffScreenShot(page, title, 'index');
      },
    );
    test(
      'basic-linear-row-container-main-axis-graverty-start-end-with-direction-rtl',
      async ({
        page,
      }, { title }) => {
        await goto(page, title);
        await diffScreenShot(page, title, 'index');
      },
    );
    test(
      'basic-linear-column-container-main-axis-graverty-top-bottom-with-direction-rtl',
      async ({
        page,
      }, { title }) => {
        await goto(page, title);
        await diffScreenShot(page, title, 'index');
      },
    );
    test(
      'basic-linear-column-container-main-axis-graverty-right-left-with-direction-rtl',
      async ({
        page,
      }, { title }) => {
        await goto(page, title);
        await diffScreenShot(page, title, 'index');
      },
    );
    test(
      'basic-linear-column-container-main-axis-graverty-start-end-with-direction-rtl',
      async ({
        page,
      }, { title }) => {
        await goto(page, title);
        await diffScreenShot(page, title, 'index');
      },
    );
    test(
      'basic-linear-row-container-main-axis-graverty-center',
      async ({ page }, {
        title,
      }) => {
        await goto(page, title);
        await diffScreenShot(page, title, 'index');
      },
    );
    test(
      'basic-linear-column-container-main-axis-graverty-center',
      async ({ page }, {
        title,
      }) => {
        await goto(page, title);
        await diffScreenShot(page, title, 'index');
      },
    );
    test('basic-linear-graverty-space-between', async ({ page }, { title }) => {
      await goto(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('basic-linear-row-cross-gravity', async ({ page }, { title }) => {
      await goto(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('basic-linear-column-cross-gravity', async ({ page }, { title }) => {
      await goto(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('basic-linear-column-align-items', async ({ page }, { title }) => {
      await goto(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test(
      'basic-linear-column-container-items-layout-gravity',
      async ({ page }, {
        title,
      }) => {
        await goto(page, title);
        await diffScreenShot(page, title, 'index');
      },
    );
    test('basic-linear-column-container-items-align-self', async ({ page }, {
      title,
    }) => {
      await goto(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('basic-linear-row-container-items-layout-gravity', async ({ page }, {
      title,
    }) => {
      await goto(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('basic-linear-child-container-wrap', async ({ page }, { title }) => {
      await goto(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('basic-linear-default-orientation', async ({ page }, { title }) => {
      await goto(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('basic-linear-grand-kid-weight', async ({ page }, { title }) => {
      await goto(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test(
      'basic-linear-column-container-main-axis-justify-content-right-left-with-direction-rtl',
      async ({ page }, { title }) => {
        await goto(page, title);
        await diffScreenShot(page, title, 'index');
      },
    );
    test(
      'basic-linear-column-container-main-axis-justify-content-center',
      async ({ page }, { title }) => {
        await goto(page, title);
        await diffScreenShot(page, title, 'index');
      },
    );
    test(
      'basic-linear-column-container-main-axis-justify-content-start-end-with-direction-rtl',
      async ({ page }, { title }) => {
        await goto(page, title);
        await diffScreenShot(page, title, 'index');
      },
    );

    test(
      'config-css-default-display-linear-false',
      async ({ page }, { title }) => {
        await goto(page, title);
        await diffScreenShot(page, title, '');
      },
    );
  });
  test.describe('flex layout', () => {
    test(
      'basic-flex-item-main-axis-content-based-min-size-not-from-content-size-suggestion',
      async ({
        page,
      }, { title }) => {
        await goto(page, title);
        await diffScreenShot(page, title, 'index');
      },
    );
    test('basic-flex-item-not-shrink-to-zero', async ({ page }, { title }) => {
      await goto(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('basic-flex-item-shrink', async ({ page }, { title }) => {
      await goto(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('basic-flex-nested-linear-setting', async ({ page }, { title }) => {
      await goto(page, title);
      const parent = page.locator('#parent');
      const child = page.locator('#child');
      await expect(parent).toHaveCSS('justify-content', 'space-between');
      await expect(parent).toHaveCSS('flex-direction', 'column');
      await expect(parent).toHaveCSS('flex-wrap', 'wrap');
      await expect(child).toHaveCSS('justify-content', 'space-between');
    });
    test('basic-flex-with-overflow', async ({ page }, { title }) => {
      await goto(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('basic-flex-1', async ({ page }, { title }) => {
      await goto(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test(
      'basic-flex-column-container-main-axis-justify-content-start-end-with-direction-rtl',
      async ({ page }, { title }) => {
        await goto(page, title);
        await diffScreenShot(page, title, 'index');
      },
    );
    test(
      'basic-flex-column-container-items-align-self',
      async ({ page }, { title }) => {
        await goto(page, title);
        await diffScreenShot(page, title, 'index');
      },
    );
    test('basic-flex-column-align-items', async ({ page }, { title }) => {
      await goto(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test(
      'basic-flex-row-container-main-axis-justify-content-start-end-with-direction-rtl',
      async ({ page }, { title }) => {
        await goto(page, title);
        await diffScreenShot(page, title, 'index');
      },
    );
  });

  test.afterEach(async ({ page, browserName, baseURL, browser }, { title }) => {
    if (browserName === 'chromium') {
      const coverage = await page.coverage.stopJSCoverage();
      const converter = v8toIstanbul(
        path.join(__dirname, '..', 'www', 'main.js'),
      );
      for (const entry of coverage) {
        await converter.load();
        converter.applyCoverage(entry.functions);
      }
      const dir = path.join(__dirname, '..', '..', '.nyc_output');
      await fs.mkdir(dir, { recursive: true });
      const converageMapData = Object.fromEntries(
        Object.entries(converter.toIstanbul()).map(([key, value]) => {
          return [key, value];
        }),
      );
      fs.writeFile(
        path.join(dir, `playwright_output_${title}.json`),
        JSON.stringify(converageMapData),
        { flag: 'w' },
      );
    }
  });
});
