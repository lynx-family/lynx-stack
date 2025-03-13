// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { swipe, dragAndHold } from './utils';
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
  screenshotOptions?: Parameters<
    ReturnType<typeof expect<Page>>['toHaveScreenshot']
  >[0],
) => {
  await expect(page).toHaveScreenshot([`${caseName}`, `${subcaseName}.png`], {
    maxDiffPixelRatio: 0,
    fullPage: true,
    animations: 'allow',
    ...screenshotOptions,
  });
};

const gotoWebComponentPage = async (page: Page, testname: string) => {
  await page.goto(`/web-element-tests/${testname}.html`, {
    waitUntil: 'load',
  });
  await page.evaluate(() => document.fonts.ready);
};

const getTitle = (titlePath: string[]) => {
  return path.join(...[titlePath.pop()!, titlePath.pop()!].reverse());
};

test.describe('web-elements test suite', () => {
  test.beforeEach(async ({ page, browserName }) => {
    if (browserName === 'chromium') {
      await page.coverage.startJSCoverage({
        reportAnonymousScripts: true,
        resetOnNavigation: true,
      });
    }
  });
  test.describe('layout', () => {
    test('layout/percentage-cyclic', async ({ page }, { title }) => {
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('layout/percentage-cyclic-text', async ({ page }, { title }) => {
      test.skip(
        true,
      );
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });

    test('layout/percentage-cyclic-sibiling', async ({ page }, { title }) => {
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('layout/percentage-cyclic-sibiling-linear', async ({ page }, {
      title,
    }) => {
      test.skip(
        true,
      );
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('layout/flex-lynx-computed-direction', async ({ page }, {
      title,
    }) => {
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('layout/flex-lynx-computed-grow', async ({ page }, {
      title,
    }) => {
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('layout/flex-lynx-computed-shrink', async ({ page }, {
      title,
    }) => {
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('layout/lynx-display-do-not-use-flatten-tree', async ({ page }, {
      title,
    }) => {
      await gotoWebComponentPage(page, title);
      await expect(page.locator('#x-list-child')).toHaveCSS('flex-shrink', '1');
      await expect(page.locator('#x-refresh-view-child')).toHaveCSS(
        'flex-shrink',
        '1',
      );
    });
  });
  test.describe('x-view', () => {
    test('dataset-attr-false-value', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await expect(page.locator('#target')).toHaveCSS(
        'background-color',
        'rgb(0, 128, 0)',
      );
    });
  });
  test.describe('x-text', () => {
    test('x-text/view-in-text', async ({ page }, { title }) => {
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('x-text/nested-view-in-text', async ({ page }, { title }) => {
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('x-text/inline-text', async ({ page }, { title }) => {
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test(
      'x-text/inline-text-with-lynx-wrapper',
      async ({ page }, { title }) => {
        await gotoWebComponentPage(page, title);
        await diffScreenShot(page, title, 'index');
      },
    );
    test('x-text/text-in-text', async ({ page }, { title }) => {
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('x-text/text-in-text-fault-torrent', async ({ page }, { title }) => {
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('x-text/text-baseline-alignment', async ({ page }, { title }) => {
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('x-text/inline-image', async ({ page }, { title }) => {
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test(
      'x-text/inline-image-with-lynx-wrapper',
      async ({ page }, { title }) => {
        await gotoWebComponentPage(page, title);
        await diffScreenShot(page, title, 'index');
      },
    );
    test('x-text/inline-image-padding-and-margin', async ({ page }, {
      title,
    }) => {
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('x-text/text-maxlength', async ({ page }, { title }) => {
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'maxlength');
    });
    test('x-text/text-maxlength-with-tail-color-convert-false', async ({
      page,
    }, { title }) => {
      await gotoWebComponentPage(page, title);
      await wait(100);
      await diffScreenShot(page, title, 'first-red-second-green');
    });
    test('x-text/text-maxline-basic', async ({ page }, { title }) => {
      await gotoWebComponentPage(page, title);
      await wait(100);
      await diffScreenShot(page, title, title);
    });
    test(
      'x-text/text-maxline-basic-with-lynx-wrapper',
      async ({ page }, { title }) => {
        await gotoWebComponentPage(page, title);
        await wait(100);
        await diffScreenShot(page, title, title);
      },
    );
    test('x-text/text-maxline-with-tail-color-convert-false', async ({ page }, {
      title,
    }) => {
      await gotoWebComponentPage(page, title);
      await wait(100);
      await diffScreenShot(page, title, title);
    });
    test('x-text/text-maxline-with-custom-truncation', async ({
      page,
      browserName,
    }, { title }) => {
      await gotoWebComponentPage(page, title);
      await wait(100);
      await diffScreenShot(page, title, title);
    });
    test('x-text/text-inline-no-whitespace', async ({ page }, { title }) => {
      await gotoWebComponentPage(page, title);
      await wait(100);
      await diffScreenShot(page, title, title);
    });
    test('x-text/text-is-block-element', async ({ page }, { title }) => {
      await gotoWebComponentPage(page, title);
      await wait(100);
      await diffScreenShot(page, title, title);
    });
    test('x-text/text-no-maxline-do-not-show-inline-truncation', async ({
      page,
    }, { title }) => {
      await gotoWebComponentPage(page, title);
      await wait(100);
      await diffScreenShot(page, title, title);
    });

    test('x-text/text-maxline-with-padding', async ({ page }, { title }) => {
      await gotoWebComponentPage(page, title);
      await wait(100);
      await diffScreenShot(page, title, title);
    });

    test('x-text/text-sizing-in-flex-container', async ({ page }, {
      title,
    }) => {
      await gotoWebComponentPage(page, title);
      await wait(100);
      await diffScreenShot(page, title, title);
    });
    test('x-text/text-maxline-just-fit-do-not-show-custom-truncation', async ({
      page,
    }, { title }) => {
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('x-text/inline-truncation-with-inline-image', async ({ page }, {
      title,
    }) => {
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });

    test('x-text/text-overflow-inherit', async ({ page }, { title }) => {
      await gotoWebComponentPage(page, title);
      await wait(100);
      await diffScreenShot(page, title, title);
    });

    test('x-text/text-maxline-with-custom-truncation-innertext-change', async ({
      page,
    }, { title }) => {
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'initial');
      await await page.locator('#target').evaluate((dom: HTMLElement) => {
        (dom.childNodes[0] as Text).data = new Array(100).fill('a').join('');
      });
      await wait(100);
      await diffScreenShot(page, title, 'inner-changed', {
        animations: 'allow',
      });
    });
    test('x-text/text-maxline-1-instrict-size', async ({ page }, { title }) => {
      await gotoWebComponentPage(page, title);
      await wait(100);
      await diffScreenShot(page, title, title, {
        clip: {
          x: 0,
          y: 0,
          width: 100,
          height: 100,
        },
      });
    });
    test('x-text/view-flex-in-text', async ({ page }, { title }) => {
      await gotoWebComponentPage(page, title);
      await wait(100);
      await diffScreenShot(page, title, title, {
        clip: {
          x: 0,
          y: 0,
          width: 300,
          height: 100,
        },
      });
    });
    test('x-text/text-clipped-display-important', async ({ page }, {
      title,
    }) => {
      await gotoWebComponentPage(page, title);
      await wait(100);
      await diffScreenShot(page, title, title, {
        clip: {
          x: 0,
          y: 0,
          width: 300,
          height: 100,
        },
      });
    });
    test('x-text/text-not-resize-detect-new-line', async ({ page }, {
      title,
    }) => {
      await gotoWebComponentPage(page, title);
      await wait(500);
      await diffScreenShot(page, title, title);
    });
    test('x-text/truncation-first-element-is-image', async ({ page }, {
      title,
    }) => {
      await gotoWebComponentPage(page, title);
      await wait(500);
      await diffScreenShot(page, title, title);
    });
    test('x-text/raw-text', async ({ page }, {
      title,
    }) => {
      await gotoWebComponentPage(page, title);
      await wait(500);
      await diffScreenShot(page, title, title);
    });
    test('x-text/raw-text-with-lynx-wrapper', async ({ page }, {
      title,
    }) => {
      await gotoWebComponentPage(page, title);
      await wait(500);
      await diffScreenShot(page, title, title);
    });
    test('x-text/text-maxlength-with-raw-text', async ({ page }, {
      title,
    }) => {
      await gotoWebComponentPage(page, title);
      await wait(500);
      await diffScreenShot(page, title, title);
    });
    test('x-text/text-maxline-with-raw-text', async ({ page }, {
      title,
    }) => {
      await gotoWebComponentPage(page, title);
      await wait(500);
      await diffScreenShot(page, title, title);
    });
  });
  test.describe('x-blur-view', () => {
    test('x-blur-view/basic', async ({ page, browserName }, { title }) => {
      test.skip(browserName === 'webkit', 'flsky test');
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
  });
  test.describe('scroll-view', () => {
    test('scroll-view/scroll-view-size-in-flex-column', async ({
      page,
      browserName,
    }, { title }) => {
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('scroll-view/scroll-view-size-in-flex-row', async ({
      page,
      browserName,
    }, { title }) => {
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('scroll-view/basic', async ({ page, browserName }, { title }) => {
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'initial');
      if (browserName === 'webkit') return; // cannot wheel
      await page.mouse.move(100, 100);
      await page.mouse.wheel(300, 0);
      await diffScreenShot(page, title, 'wheel-x-not-wheelable');
      await page.mouse.wheel(0, 300);
      await diffScreenShot(page, title, 'wheel-y-wheelable');
    });
    test('scroll-view/scroll-top', async ({ page, browserName }, { title }) => {
      await gotoWebComponentPage(page, title);
      await wait(100);
      await diffScreenShot(page, title, 'index');
    });
    test('scroll-view/scroll-left', async ({ page, browserName }, {
      title,
    }) => {
      await gotoWebComponentPage(page, title);
      await wait(100);
      await diffScreenShot(page, title, 'index');
    });
    test('scroll-view/scroll-view-overwrite-direction', async ({
      page,
    }, { title }) => {
      await gotoWebComponentPage(page, title);
      await wait(100);
      await diffScreenShot(page, title, 'index');
    });
    test('scroll-view/scroll-view-padding', async ({
      page,
    }, { title }) => {
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
      await page.evaluate(() => {
        document.querySelector('scroll-view')!.scrollTop = 300;
      });
      await diffScreenShot(page, title, 'padding-should-be-scrolled');
    });
    test('scroll-view/scroll-view-linear-gravity', async ({
      page,
    }, { title }) => {
      await gotoWebComponentPage(page, title);
      await wait(100);
      await diffScreenShot(page, title, 'index');
    });
    test('scroll-view/scroll-view-must-linear', async ({
      page,
      browserName,
    }, { title }) => {
      await gotoWebComponentPage(page, title);
      await expect(page.locator('#target')).toHaveCSS('flex-shrink', '0');
    });
    test('scroll-view/scroll-view-linear-gravity-scroll', async ({
      page,
      browserName,
    }, { title }) => {
      await gotoWebComponentPage(page, title);
      await wait(100);
      await diffScreenShot(page, title, title);
    });
    test('scroll-view/fading-edge-length', async ({
      page,
      browserName,
      context,
    }, { title }) => {
      test.skip(browserName !== 'chromium', 'using chromium only cdp methods');
      const cdpSession = await context.newCDPSession(page);
      await gotoWebComponentPage(page, title);
      await wait(100);
      await diffScreenShot(page, title, 'initial-only-bot-fading');
      await swipe(cdpSession, {
        x: 100,
        y: 250,
        xDistance: 0,
        yDistance: -200,
      });
      await diffScreenShot(page, title, 'scrolled-both-side-fading-top', {
        clip: {
          x: 0,
          y: 0,
          width: 500,
          height: 200,
        },
      });
      await diffScreenShot(page, title, 'scrolled-both-side-fading-bottom', {
        clip: {
          x: 0,
          y: 250,
          width: 500,
          height: 200,
        },
      });
      await page.mouse.move(100, 100);
      await page.mouse.wheel(0, 1000); // wheel to bottom;
      await diffScreenShot(page, title, 'scroll-to-bottom-top-fading');
      await page.evaluate(() => {
        document
          .querySelector('#test')!
          .setAttribute('fading-edge-length', '25px');
      });
      await diffScreenShot(page, title, 'attribute-changed-more-fading');
    });

    test('scroll-view/event-scroll', async ({ page, browserName, context }, {
      title,
    }) => {
      test.skip(browserName !== 'chromium', 'using chromium only cdp methods');
      const cdpSession = await context.newCDPSession(page);
      await gotoWebComponentPage(page, title);
      const events = await page
        .locator('scroll-view')
        .evaluateHandle((target) => {
          const events: (Event & { detail: any })[] = [];
          target.addEventListener('lynxscroll', (e: any) => {
            events.push({ ...e, detail: e.detail });
          });
          return events;
        });
      await swipe(cdpSession, {
        x: 100,
        y: 250,
        xDistance: 0,
        yDistance: -200,
      });
      const scrollEvents = await events.jsonValue();
      expect(scrollEvents[0].detail, 'should have detail value').not.toEqual(
        undefined,
      );
      for (
        const detailProperty of [
          'scrollTop',
          'scrollLeft',
          'scrollHeight',
          'scrollWidth',
          'isDragging',
        ]
      ) {
        expect(
          scrollEvents[0].detail[detailProperty],
          `should have detail.${detailProperty}`,
        ).not.toEqual(undefined);
      }
    });

    test('scroll-view/event-scrollend', async ({ page, browserName, context }, {
      title,
    }) => {
      await gotoWebComponentPage(page, title);
      const events = await page
        .locator('scroll-view')
        .evaluateHandle((target) => {
          const events: (Event & { detail: any })[] = [];
          target.addEventListener('lynxscrollend', (e: any) => {
            events.push({ ...e, detail: e.detail });
          });
          return events;
        });
      await page.evaluate(() => {
        document.querySelector('scroll-view')!.scrollTop = 200;
      });
      await wait(300);
      const scrollEvents = await events.jsonValue();
      expect(scrollEvents.length, 'should only have one scroll end event').toBe(
        1,
      );
      expect(scrollEvents[0]!.detail, 'should have detail value').not.toEqual(
        undefined,
      );
      for (
        const detailProperty of [
          'scrollTop',
          'scrollLeft',
          'scrollHeight',
          'scrollWidth',
          'isDragging',
        ]
      ) {
        expect(
          scrollEvents[0].detail[detailProperty],
          `should have detail.${detailProperty}`,
        ).not.toEqual(undefined);
      }
    });
    test('scroll-view/event-scrolltolower', async ({ page, browserName }, {
      title,
    }) => {
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'initial-yellow');
      await page.locator('scroll-view').evaluate((e) => (e.scrollTop = 99));
      await diffScreenShot(
        page,
        title,
        'scroll-not-trigger-scrolltolower-yellow',
      );
      await page.locator('scroll-view').evaluate((e) => (e.scrollTop = 101));
      await diffScreenShot(page, title, 'triggered-green');
    });

    test('scroll-view/method-auto-scroll', async ({ page, browserName }, {
      title,
    }) => {
      test.skip(browserName !== 'chromium', 'flaky');
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'initial');
      await page
        .locator('scroll-view')
        .evaluate((e: any) => e.autoScroll({ start: true, rate: 50 }));
      await wait(500);
      await page
        .locator('scroll-view')
        .evaluate((e: any) => e.autoScroll({ start: false, rate: 100 }));
      await diffScreenShot(page, title, 'auto-scroll-slow-rate');
      await page
        .locator('scroll-view')
        .evaluate((e: any) => e.autoScroll({ start: true, rate: 100 }));
      await wait(500);
      await page
        .locator('scroll-view')
        .evaluate((e: any) => e.autoScroll({ start: false, rate: 100 }));
      await diffScreenShot(page, title, 'auto-scroll-changed-high-rate');
    });
    test('scroll-view/scroll-to', async ({ page, browserName }, { title }) => {
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'initial');
      await page
        .locator('scroll-view')
        .evaluate((e: any) => e.scrollTo({ index: 2 }));
      await diffScreenShot(page, title, 'scroll-to-two');
      await page
        .locator('scroll-view')
        .evaluate((e: any) => e.scrollTo({ index: 0 }));
      await diffScreenShot(page, title, 'back-to-zero');
      await page
        .locator('scroll-view')
        .evaluate((e: any) => e.scrollTo({ offset: 50 }));
      await diffScreenShot(page, title, 'offset-50');
      await page
        .locator('scroll-view')
        .evaluate((e: any) => e.scrollTo({ offset: 50, index: 2 }));
      await diffScreenShot(page, title, 'offset-50-and-index-2');
    });
    test('scroll-view/scroll-to-index', async ({ page, browserName }, {
      title,
    }) => {
      await gotoWebComponentPage(page, title);
      await wait(100);
      await diffScreenShot(page, title, 'index');
    });
    test('scroll-view/scroll-view-item-percentage-size', async ({
      page,
      browserName,
    }, { title }) => {
      test.skip(browserName === 'firefox', 'browser crash');
      await gotoWebComponentPage(page, title);
      await wait(100);
      await diffScreenShot(
        page,
        title,
        'scroll-view-item-use-percentage-50-should-half-green',
      );
    });

    test('scroll-view/bounces-false', async ({ page, browserName, context }, {
      title,
    }) => {
      test.skip(browserName !== 'chromium', 'using chromium only cdp methods');
      const cdpSession = await context.newCDPSession(page);
      await gotoWebComponentPage(page, title);
      let touchRelease = await dragAndHold(cdpSession, {
        x: 100,
        y: 100,
        xDistance: 0,
        yDistance: 100,
      });
      await diffScreenShot(page, title, 'do-not-respond-tobounce');
      await touchRelease();
    });

    test('scroll-view/scroll-into-view-basic', async ({ page, browserName }, {
      title,
    }) => {
      await gotoWebComponentPage(page, title);
      await page
        .locator('#start > x-view:nth-child(3)')
        .evaluate((e: any) =>
          e.scrollIntoView({ scrollIntoViewOptions: { block: 'start' } })
        );
      await page
        .locator('#center > x-view:nth-child(3)')
        .evaluate((e: any) =>
          e.scrollIntoView({ scrollIntoViewOptions: { block: 'center' } })
        );
      await page
        .locator('#end > x-view:nth-child(3)')
        .evaluate((e: any) =>
          e.scrollIntoView({ scrollIntoViewOptions: { block: 'end' } })
        );
      await wait(100);
      await diffScreenShot(page, title, 'scrolled-into-view');
    });

    test('scroll-view/scroll-into-view-basic-x', async ({ page, browserName }, {
      title,
    }) => {
      await gotoWebComponentPage(page, title);
      await page
        .locator('#start > x-view:nth-child(3)')
        .evaluate((e: any) =>
          e.scrollIntoView({ scrollIntoViewOptions: { inline: 'start' } })
        );
      await page
        .locator('#center > x-view:nth-child(3)')
        .evaluate((e: any) =>
          e.scrollIntoView({ scrollIntoViewOptions: { inline: 'center' } })
        );
      await page
        .locator('#end > x-view:nth-child(3)')
        .evaluate((e: any) =>
          e.scrollIntoView({ scrollIntoViewOptions: { inline: 'end' } })
        );
      await wait(100);
      await diffScreenShot(page, title, 'scrolled-into-view');
    });
    test('scroll-view/scroll-into-view-text', async ({ page, browserName }, {
      title,
    }) => {
      await gotoWebComponentPage(page, title);
      await page
        .locator('#start > x-text')
        .evaluate((e: any) =>
          e.scrollIntoView({ scrollIntoViewOptions: { block: 'start' } })
        );
      await page
        .locator('#center > x-text')
        .evaluate((e: any) =>
          e.scrollIntoView({ scrollIntoViewOptions: { block: 'center' } })
        );
      await page
        .locator('#end > x-text')
        .evaluate((e: any) =>
          e.scrollIntoView({ scrollIntoViewOptions: { block: 'end' } })
        );
      await wait(100);
      await diffScreenShot(page, title, 'scrolled-into-view');
    });

    test('scroll-view/scroll-into-view-text-x', async ({ page, browserName }, {
      title,
    }) => {
      await gotoWebComponentPage(page, title);
      await page
        .locator('#start > x-text')
        .evaluate((e: any) =>
          e.scrollIntoView({ scrollIntoViewOptions: { inline: 'start' } })
        );
      await page
        .locator('#center > x-text')
        .evaluate((e: any) =>
          e.scrollIntoView({ scrollIntoViewOptions: { inline: 'center' } })
        );
      await page
        .locator('#end > x-text')
        .evaluate((e: any) =>
          e.scrollIntoView({ scrollIntoViewOptions: { inline: 'end' } })
        );
      await wait(100);
      await diffScreenShot(page, title, 'scrolled-into-view');
    });

    test('scroll-view/scroll-into-view-nested-scroll-view', async ({
      page,
      browserName,
    }, { title }) => {
      await gotoWebComponentPage(page, title);
      await page
        .locator('#target > x-view:nth-child(3)')
        .evaluate((e: any) =>
          e.scrollIntoView({ scrollIntoViewOptions: { inline: 'start' } })
        );
      await wait(100);
      await diffScreenShot(
        page,
        title,
        'scrollIntoView-do-not-scroll-outer-scroll-view',
      );
      await page.locator('#outer').evaluate((e: any) => (e.scrollTop = 200));
      await diffScreenShot(page, title, 'scrollIntoView-do-scrolled-inner');
    });

    test('scroll-view/scrollable-even-inline-overflow-visible', async ({
      page,
      browserName,
    }, { title }) => {
      await gotoWebComponentPage(page, title);
      expect(
        await page
          .locator('#target')
          .evaluate((dom) => getComputedStyle(dom).overflowY),
      ).toBe('scroll');
    });

    test('scroll-view/scroll-view-absolute-kid', async ({
      page,
      browserName,
    }, { title }) => {
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'should-show-pink-rect');
    });
  });
  test.describe('x-foldview-ng', () => {
    test('x-foldview-ng/size-controled-by-parent-flex-cross-axis', async ({
      page,
      browserName,
    }, { title }) => {
      test.skip(browserName === 'webkit', 'z-index issues for safari');
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, '300px-inf');
    });
    test('x-foldview-ng/size-parent-grow-children-specific', async ({
      page,
      browserName,
    }, { title }) => {
      test.skip(browserName === 'webkit', 'z-index issues for safari');
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, '300px-inf');
    });
    test('x-foldview-ng/size-header-height-enough', async ({
      page,
      browserName,
    }, { title }) => {
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('x-foldview-ng/size-toolbar-slot-defines-parent-size', async ({
      page,
      browserName,
    }, { title }) => {
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('x-foldview-ng/size-toolbar-slot-share-flex-parent', async ({
      page,
      browserName,
    }, { title }) => {
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('x-foldview-ng/size-toolbar-could-from-children', async ({
      page,
      browserName,
    }, { title }) => {
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('x-foldview-ng/size-header-could-from-children', async ({
      page,
      browserName,
    }, { title }) => {
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('x-foldview-ng/swipe-basic', async ({ page, browserName, context }, {
      title,
    }) => {
      test.skip(browserName !== 'chromium', 'using chromium only cdp methods');
      const cdpSession = await context.newCDPSession(page);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'initial');
      const foldview = await page.locator('x-foldview-ng');
      const scrollview = await page.locator('scroll-view');
      const foldviewInitial = await foldview.evaluate((dom: HTMLElement) =>
        dom.scrollTop
      );
      const scrollViewInitial = await scrollview.evaluate((dom: HTMLElement) =>
        dom.scrollTop
      );
      await swipe(cdpSession, {
        x: 100,
        y: 300,
        xDistance: 0,
        yDistance: -150,
        speed: 300,
      });
      expect(
        await foldview.evaluate((dom: HTMLElement) => dom.scrollTop),
        'swipe-scrollview-header-scrolled',
      ).toBeGreaterThan(foldviewInitial);
      expect(
        await scrollview.evaluate((dom: HTMLElement) => dom.scrollTop),
        'scroll-view-item-do-not-move',
      ).toEqual(scrollViewInitial);
      await swipe(cdpSession, {
        x: 100,
        y: 400,
        xDistance: 0,
        yDistance: -250,
        speed: 300,
      });
      let currentScrollviewScrolledPosition = await scrollview.evaluate((
        dom: HTMLElement,
      ) => dom.scrollTop);
      expect(
        currentScrollviewScrolledPosition,
        'swipe-header-out-continue-swipe-scroll-view',
      ).toBeGreaterThan(scrollViewInitial);
      await swipe(cdpSession, {
        x: 100,
        y: 200,
        xDistance: 0,
        yDistance: -50,
        speed: 300,
      });
      let previousScrollviewScrolledPosition =
        currentScrollviewScrolledPosition;
      currentScrollviewScrolledPosition = await scrollview.evaluate((
        dom: HTMLElement,
      ) => dom.scrollTop);
      expect(
        currentScrollviewScrolledPosition,
        'header-not-show-to-swipe-scroll-view-only',
      ).toBeGreaterThan(previousScrollviewScrolledPosition);
      let previousFoldviewScrolledPosition = await foldview.evaluate((
        dom: HTMLElement,
      ) => dom.scrollTop);
      await swipe(cdpSession, {
        x: 100,
        y: 200,
        xDistance: 0,
        yDistance: 50,
        speed: 200,
      });

      previousScrollviewScrolledPosition = currentScrollviewScrolledPosition;
      currentScrollviewScrolledPosition = await scrollview.evaluate((
        dom: HTMLElement,
      ) => dom.scrollTop);
      let currentFoldviewScrolledPosition = await foldview.evaluate((
        dom: HTMLElement,
      ) => dom.scrollTop);
      await foldview.evaluate((dom: HTMLElement) => dom.scrollTop);
      expect(
        currentScrollviewScrolledPosition,
        'header-not-show-to-swipe-back-scroll-view-only-scrollview',
      ).toBeLessThan(previousScrollviewScrolledPosition);
      expect(
        currentFoldviewScrolledPosition,
        'header-not-show-to-swipe-back-scroll-view-only-foldview',
      ).toBe(previousFoldviewScrolledPosition);
      await swipe(cdpSession, {
        x: 100,
        y: 50,
        xDistance: 0,
        yDistance: 300,
        speed: 200,
      });
      expect(
        await foldview.evaluate((dom: HTMLElement) => dom.scrollTop),
        'swipe-back-to-show-header',
      ).toBeLessThan(200);
    });
    test('x-foldview-ng/swipe-with-x-scroll-view', async ({
      page,
      browserName,
      context,
    }, { title }) => {
      test.skip(browserName !== 'chromium', 'using chromium only cdp methods');
      const cdpSession = await context.newCDPSession(page);
      await gotoWebComponentPage(page, title);
      await swipe(cdpSession, {
        x: 250,
        y: 300,
        xDistance: -200,
        yDistance: 0,
        speed: 400,
      });
      await wait(100);
      await swipe(cdpSession, {
        x: 250,
        y: 300,
        xDistance: -200,
        yDistance: 0,
        speed: 400,
      });
      const scrollLeft = await page.evaluate(() => {
        return document.querySelector('scroll-view')!.scrollLeft;
      });
      expect(scrollLeft).toBeGreaterThan(100);
    });
    test('x-foldview-ng/event-offset-granularity', async ({
      page,
      browserName,
      context,
    }, { title }) => {
      test.skip(browserName !== 'chromium', 'using chromium only cdp methods');
      const cdpSession = await context.newCDPSession(page);
      await gotoWebComponentPage(page, title);
      const events = await page
        .locator('x-foldview-ng')
        .evaluateHandle((target) => {
          const events: (Event & { detail: any })[] = [];
          target.addEventListener('offset', (e: any) => {
            events.push({ ...e, detail: e.detail });
          });
          return events;
        });
      await swipe(cdpSession, {
        x: 100,
        y: 250,
        xDistance: 0,
        yDistance: -50,
        speed: 200,
      });
      await wait(100);
      let scrollEvents = await events.jsonValue();
      expect(scrollEvents.length, 'granularity work').toBe(0);
      await swipe(cdpSession, {
        x: 100,
        y: 250,
        xDistance: 0,
        yDistance: -100,
        speed: 200,
      });
      await wait(100);
      scrollEvents = await events.jsonValue();
      expect(scrollEvents.length, 'granularity work, fire 1 event').toBe(1);
      await swipe(cdpSession, {
        x: 100,
        y: 250,
        xDistance: 0,
        yDistance: -200,
        speed: 200,
      });
      scrollEvents = await events.jsonValue();
      expect(
        scrollEvents.length,
        'scroll to end should dispatch one event',
      ).toBeGreaterThanOrEqual(2);
      expect(scrollEvents[0].detail).not.toBe(undefined);
      expect(scrollEvents[0].detail.offset).not.toBe(undefined);
      expect(scrollEvents[0].detail.height).not.toBe(undefined);
    });
    test('x-foldview-ng/basic', async ({ page }, { title }) => {
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test(
      'x-foldview-ng/basic-with-lynx-wrapper',
      async ({ page }, { title }) => {
        await gotoWebComponentPage(page, title);
        await diffScreenShot(page, title, 'index');
      },
    );
    test(
      'x-foldview-ng/with-x-viewpager-ng',
      async ({ page, browserName, context }, { title }) => {
        test.skip(
          browserName !== 'chromium',
          'using chromium only cdp methods',
        );
        const cdpSession = await context.newCDPSession(page);
        await gotoWebComponentPage(page, title);
        await diffScreenShot(page, title, 'initial');
        await swipe(cdpSession, {
          x: 180,
          y: 300,
          xDistance: -150,
          yDistance: 0,
          speed: 400,
        });
        await diffScreenShot(page, title, 'x-viewpager-ng-could-be-swiped');
      },
    );

    test(
      'x-foldview-ng/with-x-refresh-view',
      async ({ page, browserName, context }, {
        title,
      }) => {
        test.skip(
          browserName !== 'chromium',
          'using chromium only cdp methods',
        );
        const cdpSession = await context.newCDPSession(page);
        await gotoWebComponentPage(page, title);
        await diffScreenShot(page, title, 'initial');
        const foldview = await page.locator('x-foldview-ng');
        const scrollview = await page.locator('scroll-view');
        const foldviewInitial = await foldview.evaluate((dom: HTMLElement) =>
          dom.scrollTop
        );
        const scrollViewInitial = await scrollview.evaluate((
          dom: HTMLElement,
        ) => dom.scrollTop);
        await swipe(cdpSession, {
          x: 100,
          y: 300,
          xDistance: 0,
          yDistance: -150,
          speed: 300,
        });
        expect(
          await foldview.evaluate((dom: HTMLElement) => dom.scrollTop),
          'swipe-scrollview-header-scrolled',
        ).toBeGreaterThan(foldviewInitial);
        expect(
          await scrollview.evaluate((dom: HTMLElement) => dom.scrollTop),
          'scroll-view-item-do-not-move',
        ).toEqual(scrollViewInitial);
        await swipe(cdpSession, {
          x: 100,
          y: 400,
          xDistance: 0,
          yDistance: -250,
          speed: 300,
        });
        let currentScrollviewScrolledPosition = await scrollview.evaluate((
          dom: HTMLElement,
        ) => dom.scrollTop);
        expect(
          currentScrollviewScrolledPosition,
          'swipe-header-out-continue-swipe-scroll-view',
        ).toBeGreaterThan(scrollViewInitial);
        await swipe(cdpSession, {
          x: 100,
          y: 200,
          xDistance: 0,
          yDistance: -50,
          speed: 300,
        });
        let previousScrollviewScrolledPosition =
          currentScrollviewScrolledPosition;
        currentScrollviewScrolledPosition = await scrollview.evaluate((
          dom: HTMLElement,
        ) => dom.scrollTop);
        expect(
          currentScrollviewScrolledPosition,
          'header-not-show-to-swipe-scroll-view-only',
        ).toBeGreaterThan(previousScrollviewScrolledPosition);
        let previousFoldviewScrolledPosition = await foldview.evaluate((
          dom: HTMLElement,
        ) => dom.scrollTop);
        await swipe(cdpSession, {
          x: 100,
          y: 200,
          xDistance: 0,
          yDistance: 50,
          speed: 200,
        });

        previousScrollviewScrolledPosition = currentScrollviewScrolledPosition;
        currentScrollviewScrolledPosition = await scrollview.evaluate((
          dom: HTMLElement,
        ) => dom.scrollTop);
        let currentFoldviewScrolledPosition = await foldview.evaluate((
          dom: HTMLElement,
        ) => dom.scrollTop);
        await foldview.evaluate((dom: HTMLElement) => dom.scrollTop);
        expect(
          currentScrollviewScrolledPosition,
          'header-not-show-to-swipe-back-scroll-view-only-scrollview',
        ).toBeLessThan(previousScrollviewScrolledPosition);
        expect(
          currentFoldviewScrolledPosition,
          'header-not-show-to-swipe-back-scroll-view-only-foldview',
        ).toBe(previousFoldviewScrolledPosition);
        await swipe(cdpSession, {
          x: 100,
          y: 50,
          xDistance: 0,
          yDistance: 300,
          speed: 200,
        });
        expect(
          await foldview.evaluate((dom: HTMLElement) => dom.scrollTop),
          'swipe-back-to-show-header',
        ).toBeLessThan(200);
      },
    );

    test(
      'x-foldview-ng/with-x-viewpager-ng-pan-both-x-and-y',
      async ({ page, browserName, context }, { title }) => {
        test.skip(
          browserName !== 'chromium',
          'using chromium only cdp methods',
        );
        const cdpSession = await context.newCDPSession(page);
        await gotoWebComponentPage(page, title);
        await wait(100);
        await diffScreenShot(page, title, 'initial');
        await swipe(cdpSession, {
          x: 180,
          y: 300,
          xDistance: -150,
          yDistance: -50,
          speed: 200,
        });
        await diffScreenShot(page, title, 'x-viewpager-ng-could-be-swiped', {
          clip: {
            x: 0,
            y: 220,
            width: 400,
            height: 100,
          },
        });
      },
    );
  });
  test.describe('x-viewpager-ng', () => {
    test('x-viewpager-ng/viewpager-size-cyclic-percentage-size', async ({
      page,
      browserName,
    }, { title }) => {
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'basic');
    });

    test('x-viewpager-ng/select-index', async ({ page }, { title }) => {
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'initial-sandybrown');
    });

    test('x-viewpager-ng/basic', async ({ page, browserName, context }, {
      title,
    }) => {
      test.skip(browserName !== 'chromium', 'cannot swipe');
      await gotoWebComponentPage(page, title);
      const cdpSession = await context.newCDPSession(page);
      await diffScreenShot(page, title, 'initial');
      await swipe(cdpSession, {
        x: 190,
        y: 50,
        xDistance: -150,
        yDistance: 0,
      });
      await diffScreenShot(page, title, 'swipe-1');
      await swipe(cdpSession, {
        x: 190,
        y: 50,
        xDistance: -150,
        yDistance: 0,
      });
      await diffScreenShot(page, title, 'swipe-2');
    });
    test(
      'x-viewpager-ng/basic-with-lynx-wrapper',
      async ({ page, browserName, context }, {
        title,
      }) => {
        test.skip(browserName !== 'chromium', 'cannot swipe');
        await gotoWebComponentPage(page, title);
        const cdpSession = await context.newCDPSession(page);
        await diffScreenShot(page, title, 'initial');
        await swipe(cdpSession, {
          x: 190,
          y: 50,
          xDistance: -150,
          yDistance: 0,
        });
        await diffScreenShot(page, title, 'swipe-1');
        await swipe(cdpSession, {
          x: 190,
          y: 50,
          xDistance: -150,
          yDistance: 0,
        });
        await diffScreenShot(page, title, 'swipe-2');
      },
    );
    test('x-viewpager-ng/bounces', async ({ page, browserName, context }, {
      title,
    }) => {
      test.skip(browserName !== 'chromium', 'cannot swipe');
      await gotoWebComponentPage(page, title);
      await wait(100);
      const cdpSession = await context.newCDPSession(page);
      let touchRelease = await dragAndHold(cdpSession, {
        x: 10,
        y: 100,
        xDistance: 100,
        yDistance: 0,
      });
      await diffScreenShot(page, title, 'drag-show-bounce-area');
      await touchRelease();
      await wait(500);
      await diffScreenShot(page, title, 'bounce-back');
    });

    test(
      'x-viewpager-ng/event-offsetchange-offset-value',
      async ({ page, browserName, context }, {
        title,
      }) => {
        test.skip(browserName !== 'chromium', 'cannot swipe');
        await gotoWebComponentPage(page, title);
        const offsetValue = await page
          .locator('#target')
          .evaluateHandle((target) => {
            let detail = { offset: undefined };
            target.addEventListener('offsetchange', (e) => {
              detail.offset = (e as any).detail.offset;
            });
            return detail;
          });
        const cdpSession = await context.newCDPSession(page);
        await swipe(cdpSession, {
          x: 190,
          y: 100,
          xDistance: -150,
          yDistance: 0,
        });
        await wait(500);
        await dragAndHold(cdpSession, {
          x: 150,
          y: 100,
          xDistance: -100,
          yDistance: 0,
        });
        await wait(1000);
        const offset = (await offsetValue.jsonValue()).offset;
        expect(offset).toBeGreaterThan(1.4);
        expect(offset).toBeLessThan(1.6);
      },
    );

    test(
      'x-viewpager-ng/selecttab-method-not-smooth',
      async ({ page, browserName, context }, {
        title,
      }) => {
        test.skip(
          browserName === 'chromium',
          'chromium will skip the smooth scrolling',
        );
        await gotoWebComponentPage(page, title);
        const eventCountPromise = await page
          .locator('#target')
          .evaluateHandle((target) => {
            let detail = { count: 0 };
            target.addEventListener('offsetchange', (e) => {
              detail.count++;
            });
            return detail;
          });
        await page.locator('#target').evaluate((dom: any) =>
          dom.selectTab({
            index: 3,
            smooth: false,
          })
        );
        await wait(2000);
        const countNotSmooth = (await eventCountPromise.jsonValue()).count;
        expect(countNotSmooth).toBe(1);
      },
    );

    test(
      'x-viewpager-ng/selecttab-method-default-smooth',
      async ({ page, browserName, context }, {
        title,
      }) => {
        test.skip(
          browserName === 'chromium',
          'chromium will skip the smooth scrolling',
        );
        await gotoWebComponentPage(page, title);
        const eventCountPromise = await page
          .locator('#target')
          .evaluateHandle((target) => {
            let detail = { count: 0 };
            target.addEventListener('offsetchange', (e) => {
              detail.count++;
            });
            return detail;
          });
        await page.locator('#target').evaluate((dom: any) =>
          dom.selectTab({
            index: 3,
          })
        );
        await wait(2000);
        const countNotSmooth = (await eventCountPromise.jsonValue()).count;
        expect(countNotSmooth).toBeGreaterThan(1);
      },
    );

    test(
      'x-viewpager-ng/select-index-0',
      async ({ page, browserName, context }, {
        title,
      }) => {
        await gotoWebComponentPage(page, title);
        await wait(300);
        await diffScreenShot(page, title, 'initial-color-fuchsia');
        await wait(100);
        await page.locator('#target').evaluate(dom =>
          dom.setAttribute('select-index', '0')
        );
        await wait(1000);
        await diffScreenShot(page, title, 'show-wheat');
      },
    );

    test(
      'x-viewpager-ng/do-not-response-to-select-index-on-dragging',
      async ({ page, browserName, context }, {
        title,
      }) => {
        test.skip(browserName !== 'chromium', 'cannot swipe');
        gotoWebComponentPage(page, title);
        await wait(100);
        const cdpSession = await context.newCDPSession(page);
        let touchRelease = await dragAndHold(cdpSession, {
          x: 150,
          y: 100,
          xDistance: -70,
          yDistance: 0,
        });
        const clip = {
          x: 0,
          y: 0,
          width: 100,
          height: 200,
        };
        await diffScreenShot(page, title, 'initial', { clip });
        await page.locator('#target').evaluate(dom =>
          dom.setAttribute('select-index', '2')
        );
        await wait(500);
        await diffScreenShot(page, title, 'same-to-initial', { clip });
        await wait(500);
        await touchRelease();
        await wait(500);
        await diffScreenShot(page, title, 'finish', { clip });
      },
    );
  });
  test.describe('filter-image', () => {
    test('basic', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('mode-aspectfit', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('mode-aspectfill', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('mode-center', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('basic-placeholder', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title.replace('-placeholder', ''), 'index');
    });
    test('mode-aspectfit-placeholder', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title.replace('-placeholder', ''), 'index');
    });
    test('mode-aspectfill-placeholder', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title.replace('-placeholder', ''), 'index');
    });
    test('mode-center-placeholder', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title.replace('-placeholder', ''), 'index');
    });
    test('blur-radius', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('drop-shadow', async ({ page, browserName }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('event-load', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await expect(page.locator('#target')).toHaveCSS(
        'background-color',
        'rgb(0, 128, 0)',
      );
    });
    test('event-error', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await expect(page.locator('#target')).toHaveCSS(
        'background-color',
        'rgb(0, 128, 0)',
      );
    });
  });
  test.describe('x-image', () => {
    test('basic', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('mode-aspectfit', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('mode-aspectfill', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('mode-center', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('basic-placeholder', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title.replace('-placeholder', ''), 'index');
    });
    test('mode-aspectfit-placeholder', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title.replace('-placeholder', ''), 'index');
    });
    test('mode-aspectfill-placeholder', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title.replace('-placeholder', ''), 'index');
    });
    test('mode-center-placeholder', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title.replace('-placeholder', ''), 'index');
    });
    test('placeholder-src-not-exist', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'firefox');
    });
    test('placeholder-src-do-exist', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'chromium');
    });
    test(
      'placeholder-src-change-with-placeholder-exist',
      async ({ page }, { titlePath }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        await page.locator('#target').evaluate((target) =>
          target.setAttribute('src', 'path/do/not/exist')
        );
        await wait(100);
        await diffScreenShot(page, title, 'should-show-placeholder-firefox');
        await page.locator('#target').evaluate((target) =>
          target.setAttribute('src', '../../resources/chromium-logo.png')
        );
        await diffScreenShot(page, title, 'should-show-new-src-chromium');
      },
    );
    test('border-radius', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('blur-radius', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('event-load', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await expect(page.locator('#target')).toHaveCSS(
        'background-color',
        'rgb(0, 128, 0)',
      );
    });
    test('event-error', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await expect(page.locator('#target')).toHaveCSS(
        'background-color',
        'rgb(0, 128, 0)',
      );
    });
    test('position-basic', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('position', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('basic-inherit', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
  });
  test.afterEach(
    async ({ page, browserName, baseURL, browser }, { titlePath }) => {
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
          path.join(
            dir,
            `playwright_output_${
              getTitle(titlePath).replaceAll('/', '_')
            }.json`,
          ),
          JSON.stringify(converageMapData),
          { flag: 'w' },
        );
      }
    },
  );

  test.describe('x-list', () => {
    test('basic', async ({ page, browserName }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'initial');
      if (browserName === 'webkit') test.skip(); // cannot wheel
      await page.mouse.move(100, 100);
      await page.mouse.wheel(300, 0);
      await diffScreenShot(page, title, 'wheel-x-not-wheelable');
      await page.mouse.wheel(0, 300);
      await diffScreenShot(page, title, 'wheel-y-wheelable');
    });

    test('enable-scroll', async ({ page, browserName }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'initial');
      if (browserName === 'webkit') test.skip(); // cannot wheel
      await page.mouse.wheel(0, 300);
      await diffScreenShot(page, title, 'wheel-y-not-wheelable');
      await page.evaluate(() => {
        document.querySelector('x-list')?.shadowRoot?.querySelector('#content')
          ?.scrollBy(0, 300);
      });
      await diffScreenShot(page, title, 'scroll-by-js');
    });

    test(
      'scroll-orientation',
      async ({ page, browserName }, { titlePath }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        await diffScreenShot(page, title, 'initial');
      },
    );

    test('sticky', async ({ page, browserName }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
      if (browserName === 'webkit') test.skip(); // cannot wheel
      await page.mouse.move(200, 300);
      await page.mouse.wheel(0, 500);
      await diffScreenShot(page, title, 'sticky-y-scroll');
    });

    test('sticky-offset', async ({ page, browserName }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
      if (browserName === 'webkit') test.skip(); // cannot wheel
      await page.mouse.move(200, 300);
      await page.mouse.wheel(0, 500);
      await diffScreenShot(page, title, 'sticky-offset-y-scroll');
    });

    test('initial-scroll-index', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await wait(100);
      await diffScreenShot(page, title, 'index');
    });

    test('item-snap', async ({ page, browserName }, { titlePath }) => {
      if (browserName === 'webkit') test.skip(); // cannot wheel
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
      await page.evaluate(() => {
        document.querySelector('x-list')?.shadowRoot?.querySelector('#content')
          ?.scrollBy(0, 10);
      });
      await wait(100);
      await diffScreenShot(page, title, 'scroll-1');
      await page.evaluate(() => {
        document.querySelector('x-list')?.shadowRoot?.querySelector('#content')
          ?.scrollBy(0, 250);
      });
      await wait(100);
      await diffScreenShot(page, title, 'scroll-2');
    });

    test('event-scroll', async ({ page, browserName }, { titlePath }) => {
      let scrolled = false;
      let scrollend = false;
      await page.on('console', async (msg) => {
        const event = await msg.args()[0]?.evaluate((e) => ({
          type: e.type,
        }));
        if (!event) return;
        if (event.type === 'lynxscroll') {
          scrolled = true;
        }
        if (event.type === 'lynxscrollend') {
          scrollend = true;
        }
      });

      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await page.evaluate(() => {
        document.querySelector('x-list')?.shadowRoot?.querySelector(
          '#content',
        )
          ?.scrollTo(0, 500);
      });
      await wait(1000);
      expect(scrolled).toBeTruthy();
      expect(scrollend).toBeTruthy();
    });

    test(
      'event-scrolltolower',
      async ({ page, browserName }, { titlePath }) => {
        if (browserName === 'webkit') test.skip(); // cannot wheel
        let scrolltolower = false;
        await page.on('console', async (msg) => {
          const event = await msg.args()[0]?.evaluate((e) => ({
            type: e.type,
          }));
          if (!event) return;
          if (event.type === 'scrolltolower') {
            scrolltolower = true;
          }
        });
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        await wait(1000);
        await page.evaluate(() => {
          document.querySelector('x-list')?.shadowRoot?.querySelector(
            '#content',
          )
            ?.scrollTo(0, 5000);
        });
        await wait(1000);
        expect(scrolltolower).toBeTruthy();
      },
    );

    test(
      'event-scrolltoupper',
      async ({ page, browserName }, { titlePath }) => {
        if (browserName === 'webkit') test.skip(); // cannot wheel
        let scrolltoupper = false;
        await page.on('console', async (msg) => {
          const event = await msg.args()[0]?.evaluate((e) => ({
            type: e.type,
          }));
          if (!event) return;
          if (event.type === 'scrolltoupper') {
            scrolltoupper = true;
          }
        });
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        await wait(1000);
        await page.mouse.move(200, 200);
        await page.mouse.wheel(0, 100);
        await page.mouse.wheel(0, -500);
        await wait(100);
        expect(scrolltoupper).toBeTruthy();
      },
    );

    test(
      'event-lower-threshold-item-count',
      async ({ page, browserName }, { titlePath }) => {
        if (browserName === 'webkit') test.skip(); // cannot wheel
        let scrolltolower = false;
        await page.on('console', async (msg) => {
          const event = await msg.args()[0]?.evaluate((e) => ({
            type: e.type,
          }));
          if (!event) return;
          if (event.type === 'scrolltolower') {
            scrolltolower = true;
          }
        });
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        await wait(1000);
        await page.evaluate(() => {
          document.querySelector('x-list')?.shadowRoot?.querySelector(
            '#content',
          )?.scrollTo(0, 1000);
        });
        await wait(1000);
        expect(scrolltolower).toBeTruthy();
      },
    );

    test(
      'event-lower-load-more',
      async ({ page, browserName }, { titlePath }) => {
        if (browserName === 'webkit') test.skip(); // cannot wheel

        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        await wait(1000);
        await page.evaluate(() => {
          document.querySelector('x-list')?.shadowRoot?.querySelector(
            '#content',
          )?.scrollTo(0, 3000);
        });
        let scrolltolower = false;
        await page.on('console', async (msg) => {
          const event = await msg.args()[0]?.evaluate((e) => ({
            type: e.type,
          }));
          if (!event) return;
          if (event.type === 'scrolltolower') {
            scrolltolower = true;
          }
        });

        await wait(100);
        await page.locator('#target').click();
        await wait(100);
        expect(scrolltolower).toBeTruthy();
      },
    );

    test(
      'event-snap',
      async ({ page, browserName }, { titlePath }) => {
        if (browserName === 'webkit') test.skip(); // cannot wheel
        let position = undefined;
        let scrollLeft = undefined;
        let scrollTop = undefined;
        await page.on('console', async (msg) => {
          const event = await msg.args()[0]?.evaluate((e) => ({
            type: e.type,
            position: e.detail?.position,
            scrollLeft: e.detail?.scrollLeft,
            scrollTop: e.detail?.scrollTop,
          }));
          if (!event) return;
          if (event.type === 'snap') {
            position = event.position;
            scrollLeft = event.scrollLeft;
            scrollTop = event.scrollTop;
          }
        });
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        await wait(1000);
        await page.evaluate(() => {
          document.querySelector('x-list')?.shadowRoot?.querySelector(
            '#content',
          )
            ?.scrollBy(0, 10);
        });
        await wait(100);
        expect(position).toBe(1);
        expect(scrollLeft).toBe(0);
        expect(scrollTop).toBe(100);
        await page.evaluate(() => {
          document.querySelector('x-list')?.shadowRoot?.querySelector(
            '#content',
          )
            ?.scrollBy(0, 250);
        });
        await wait(100);
        expect(position).toBe(3);
        expect(scrollLeft).toBe(0);
        expect(scrollTop).toBe(300);
      },
    );

    test(
      'event-layoutcomplete',
      async ({ page, browserName }, { titlePath }) => {
        // contentvisibilityautostatechange not propagate
        if (browserName === 'webkit' || browserName === 'firefox') test.skip(); // cannot wheel
        let visibleItemBeforeUpdate = undefined;
        let visibleItemAfterUpdate = undefined;
        await page.on('console', async (msg) => {
          const event = await msg.args()[0]?.evaluate((e) => ({
            type: e.type,
            visibleItemBeforeUpdate: e.detail?.visibleItemBeforeUpdate,
            visibleItemAfterUpdate: e.detail?.visibleItemAfterUpdate,
          }));
          if (!event) return;
          if (event.type === 'layoutcomplete') {
            visibleItemBeforeUpdate = event.visibleItemBeforeUpdate;
            visibleItemAfterUpdate = event.visibleItemAfterUpdate;
          }
        });
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        await wait(1000);
        expect(
          Array.isArray(visibleItemBeforeUpdate)
            && (visibleItemBeforeUpdate as unknown[]).length === 0,
        ).toBeTruthy();
        expect(
          Array.isArray(visibleItemAfterUpdate),
          // && (visibleItemAfterUpdate as unknown[]).length > 0
          // && (visibleItemAfterUpdate as any[])[0].itemKey !== undefined
          // && (visibleItemAfterUpdate as any[])[0].width !== 0
          // && (visibleItemAfterUpdate as any[])[0].height !== 0
          // && (visibleItemAfterUpdate as any[])[0].originX === 0
          // && (visibleItemAfterUpdate as any[])[0].originY === 0,
        ).toBeTruthy();
      },
    );

    test(
      'scroll-to-position',
      async ({ page }, { titlePath }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        await diffScreenShot(page, title, 'initial');
        await wait(1000);
        await page.locator('#scrollToPosition').click();
        await diffScreenShot(page, title, 'scroll-to-position');
      },
    );

    test(
      'auto-scroll',
      async ({ page }, { titlePath }) => {
        let scrolled = 0;
        await page.on('console', async (msg) => {
          const event = await msg.args()[0]?.evaluate((e) => ({
            type: e.type,
          }));
          if (!event) return;
          if (event.type === 'lynxscroll') {
            scrolled++;
          }
        });

        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        await diffScreenShot(page, title, 'initial');
        await wait(1000);
        await page.locator('#autoScroll').click();
        await wait(4000);
        await expect(scrolled).toBe(4);
      },
    );

    test(
      'get-visible-cells',
      async ({ page, browserName }, { titlePath }) => {
        // contentvisibilityautostatechange not propagate
        if (browserName === 'webkit' || browserName === 'firefox') test.skip(); // cannot wheel
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        await wait(1000);
        await page.evaluate(() => {
        });
        const cells = await page
          .evaluateHandle(() => {
            return (document.querySelector('x-list') as any)?.getVisibleCells();
          });
        const data = await cells.jsonValue();
        expect(
          Array.isArray(data),
          // Array.isArray(data) && data.length > 10
          //   && data.every(
          //     i => (i.bottom !== undefined && i.top !== undefined
          //       && i.left !== undefined && i.right !== undefined
          //       && i.index !== undefined && i.itemKey !== undefined),
          //   ),
        ).toBeTruthy();
      },
    );

    test(
      'get-scroll-container-info',
      async ({ page }, { titlePath }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        await wait(1000);
        await page.evaluate(() => {
        });
        const info1 = await (await page
          .evaluateHandle(() => {
            return (document.querySelector('x-list') as any)
              ?.getScrollContainerInfo();
          })).jsonValue();
        expect(
          typeof info1 === 'object' && info1.scrollLeft === 0
            && info1.scrollTop === 0 && info1.scrollHeight !== 0
            && info1.scrollWidth !== 0,
        ).toBeTruthy();
        await page.evaluate(() =>
          document.querySelector('x-list')?.shadowRoot?.querySelector(
            '#content',
          )
            ?.scrollBy(0, 200)
        );
        const info2 = await (await page
          .evaluateHandle(() => {
            return (document.querySelector('x-list') as any)
              ?.getScrollContainerInfo();
          })).jsonValue();
        expect(
          typeof info2 === 'object' && info2.scrollLeft === 200
            && info2.scrollTop === 200 && info2.scrollHeight !== 0
            && info2.scrollWidth !== 0,
        ).toBeTruthy();
      },
    );
  });
  test.describe('x-input', () => {
    test('placeholder', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });

    test('placeholder-color', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });

    test('placeholder-weight', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });

    test(
      'attribute-value',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        await diffScreenShot(page, title, simpleTitle);
      },
    );

    test(
      'attribute-maxlength-first-screen-cut-value',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        await diffScreenShot(page, title, 'text-hello');
      },
    );

    test(
      'attribute-maxlength-change-do-not-change-value',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        await diffScreenShot(page, title, 'initial-10');
        await page.locator('#target').evaluate((dom) =>
          dom.setAttribute('maxlength', '5')
        );
        await diffScreenShot(page, title, 'maxlength-changed-still-10');
        await page.locator('#target').evaluate((dom) =>
          dom.setAttribute('value', '12345678')
        );
        await diffScreenShot(page, title, 'show-5');
      },
    );

    test(
      'type-value-do-not-show-input',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        await page.mouse.click(100, 25);
        await page.keyboard.type('h');
        await diffScreenShot(page, title, 'text-h');
      },
    );

    test(
      'type-password',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        await page.mouse.click(100, 25);
        await page.keyboard.type('hello password');
        await wait(500);
        await diffScreenShot(page, title, 'show-password');
      },
    );

    test(
      'press-enter-do-not-submit-value',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        await page.mouse.click(100, 25);
        await page.keyboard.type('hello');
        await diffScreenShot(page, title, 'show-hello');
        await page.keyboard.type('\n');
        await diffScreenShot(page, title, 'show-hello');
      },
    );

    test(
      'attribute-type-digit',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        const inputmode = await page.locator('input').getAttribute('inputmode');
        expect(inputmode).toBe('numeric');
      },
    );

    test(
      'attribute-type-email',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        const inputmode = await page.locator('input').getAttribute('inputmode');
        expect(inputmode).toBe('email');
      },
    );

    test(
      'attribute-type-number',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        const inputmode = await page.locator('input').getAttribute('inputmode');
        expect(inputmode).toBe('decimal');
      },
    );

    test(
      'attribute-type-tel',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        const inputmode = await page.locator('input').getAttribute('inputmode');
        expect(inputmode).toBe('tel');
      },
    );

    test(
      'attribute-type-text',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        const inputmode = await page.locator('input').getAttribute('inputmode');
        expect(inputmode).toBe('text');
      },
    );

    test(
      'attribute-spell-check',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        const spellcheck = await page.locator('input').getAttribute(
          'spellcheck',
        );
        expect(spellcheck).toBe('true');
      },
    );

    test(
      'attribute-confirm-type-send',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        const attributeValue = await page.locator('input').getAttribute(
          'enterkeyhint',
        );
        expect(attributeValue).toBe('send');
      },
    );

    test(
      'attribute-confirm-type-search',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        const attributeValue = await page.locator('input').getAttribute(
          'enterkeyhint',
        );
        expect(attributeValue).toBe('search');
      },
    );

    test(
      'attribute-confirm-type-next',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        const attributeValue = await page.locator('input').getAttribute(
          'enterkeyhint',
        );
        expect(attributeValue).toBe('next');
      },
    );

    test(
      'attribute-confirm-type-go',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        const attributeValue = await page.locator('input').getAttribute(
          'enterkeyhint',
        );
        expect(attributeValue).toBe('go');
      },
    );

    test(
      'attribute-confirm-type-done',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        const attributeValue = await page.locator('input').getAttribute(
          'enterkeyhint',
        );
        expect(attributeValue).toBe('done');
      },
    );

    test(
      'attribute-disabled',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        await diffScreenShot(page, title, 'disabled');
        await page.mouse.click(100, 25);
        await page.keyboard.type('hello');
        await diffScreenShot(page, title, 'disabled');
      },
    );

    test(
      'attribute-readonly',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        await diffScreenShot(page, title, 'readonly');
        await page.mouse.click(100, 25);
        await page.keyboard.type('hello');
        await diffScreenShot(page, title, 'readonly');
      },
    );

    test(
      'event-confirm',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        await page.mouse.click(100, 25);
        await page.keyboard.type('hello');
        const confirmValue = await page
          .locator('#target')
          .evaluateHandle((target) => {
            let detail = { value: undefined };
            target.addEventListener('confirm', (e) => {
              detail.value = (e as any).detail.value;
            });
            return detail;
          });
        await page.keyboard.type('\n');
        await wait(100);
        expect((await confirmValue.jsonValue()).value).toBe('hello');
      },
    );

    test(
      'event-focus-blur',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        const valuesPromise = await page
          .locator('#target')
          .evaluateHandle((target) => {
            let details: { value: undefined; eventType: string }[] = [];
            target.addEventListener('lynxfocus', (e) => {
              details.push({
                value: (e as any).detail.value,
                eventType: e.type,
              });
            });
            target.addEventListener('lynxblur', (e) => {
              details.push({
                value: (e as any).detail.value,
                eventType: e.type,
              });
            });
            return details;
          });
        await page.mouse.click(100, 25);
        await wait(500);
        await page.mouse.click(300, 325);
        await wait(500);
        const values = await valuesPromise.jsonValue();
        expect(values[0].value).toBe('hello');
        expect(values[0].eventType).toBe('lynxfocus');
        expect(values[1].value).toBe('hello');
        expect(values[1].eventType).toBe('lynxblur');
      },
    );

    test(
      'method-addText',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, 'x-input/method');
        await wait(100);
        await page
          .locator('#target')
          .evaluate((target: any) => {
            target.addText({
              text: 'add-text',
            });
          });
        await diffScreenShot(page, title, 'show-helloadd-text');
      },
    );

    test(
      'method-setValue',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, 'x-input/method');
        await wait(100);
        await page
          .locator('#target')
          .evaluate((target: any) => {
            target.setValue({
              value: 'add-text',
              index: 3,
            });
          });
        await page
          .locator('#target')
          .evaluate((target: any) => {
            target.addText({
              text: '3',
            });
          });
        await diffScreenShot(page, title, 'add3-text');
      },
    );

    test(
      'method-sendDelEvent',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, 'x-input/method');
        await wait(100);
        await page
          .locator('#target')
          .evaluate((target: any) => {
            target.sendDelEvent({
              action: 1,
            });
          });
        await diffScreenShot(page, title, 'hell');
        await page
          .locator('#target')
          .evaluate((target: any) => {
            target.sendDelEvent({
              action: 0,
              length: 2,
            });
          });
        await diffScreenShot(page, title, 'he');
      },
    );

    test(
      'method-select',
      async ({ page, browserName }, { titlePath, title: simpleTitle }) => {
        test.skip(
          browserName !== 'chromium',
          'cannot demostrate the text is selected',
        );
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, 'x-input/method');
        await wait(100);
        await page
          .locator('#target')
          .evaluate((target: any) => {
            target.select();
          });
        await wait(100);
        await diffScreenShot(page, title, 'method-select');
      },
    );

    test(
      'method-setSelectionRange',
      async ({ page, browserName }, { titlePath, title: simpleTitle }) => {
        test.skip(
          browserName === 'firefox',
          'cannot demostrate the text is selected',
        );
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, 'x-input/method');
        await wait(100);
        await page
          .locator('#target')
          .evaluate((target: any) => {
            target.setSelectionRange({
              selectionStart: 2,
              selectionEnd: 4,
            });
          });
        await wait(100);
        await diffScreenShot(page, title, 'select-ll');
      },
    );
    test(
      'style-background-color',
      async ({ page }, { titlePath }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        await diffScreenShot(page, title, 'initial');
      },
    );
    test(
      'style-inherit-margin',
      async ({ page }, { titlePath }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        await diffScreenShot(page, title, 'initial');
      },
    );
    test(
      'style-inherit-color',
      async ({ page }, { titlePath }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        await diffScreenShot(page, title, 'initial');
      },
    );
  });

  test.describe('x-overlay', () => {
    test('x-overlay-ng/basic-z-index', async ({ page }, { title }) => {
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'red-cover-next-z-staking-rect');
    });
  });

  test.describe('x-refresh-view', () => {
    test('x-refresh-view/basic', async ({ page }, { title }) => {
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'initial');
    });
    test('x-refresh-view/pull', async ({ page, browserName, context }, {
      title,
    }) => {
      test.skip(browserName !== 'chromium', 'cannot swipe');
      test.slow();
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'initial');
      const cdpSession = await context.newCDPSession(page);
      let stopHold = await dragAndHold(cdpSession, {
        x: 100,
        y: 100,
        xDistance: 0,
        yDistance: 200,
      });
      await wait(1000);
      await stopHold();
      await wait(1000);
      await diffScreenShot(
        page,
        title,
        'pull-down-to-refresh-keep-pull-down-status',
      );
      stopHold = await dragAndHold(cdpSession, {
        x: 100,
        y: 300,
        xDistance: 0,
        yDistance: -200,
      });
      await wait(1000);
      await stopHold();
      await wait(1000);
      await diffScreenShot(page, title, 'pull-up-footer-keep-pull-up-status', {
        fullPage: true,
      });
    });
    test('x-refresh-view/enable-refresh-false', async ({
      page,
      browserName,
      context,
    }, { title }) => {
      test.skip(browserName != 'chromium', 'cannot wheel');
      await gotoWebComponentPage(page, title);
      const cdpSession = await context.newCDPSession(page);
      let touchRelease = await dragAndHold(cdpSession, {
        x: 100,
        y: 100,
        xDistance: 0,
        yDistance: 100,
      });
      await diffScreenShot(page, title, 'cannot-pull-down');
      await touchRelease();
      await wait(100);
      touchRelease = await dragAndHold(cdpSession, {
        x: 100,
        y: 200,
        xDistance: 0,
        yDistance: -100,
      });
      await diffScreenShot(page, title, 'pull-up-footer-can-show');
      await touchRelease();
      await wait(100);
    });

    test('x-refresh-view/enable-loadmore-false', async ({
      page,
      browserName,
      context,
    }, { title }) => {
      test.skip(browserName != 'chromium', 'cannot wheel');
      await gotoWebComponentPage(page, title);
      const cdpSession = await context.newCDPSession(page);
      let touchRelease = await dragAndHold(cdpSession, {
        x: 100,
        y: 300,
        xDistance: 0,
        yDistance: -200,
      });
      expect(
        await page.locator('x-view#content').getAttribute('style'),
      ).not.toContain('chartreuse');
      await touchRelease();
      await wait(100);
    });

    test('x-refresh-view/enable-auto-loadmore-false', async ({
      page,
      browserName,
      context,
    }, { title }) => {
      test.skip(browserName != 'chromium', 'cannot wheel');
      await gotoWebComponentPage(page, title);
      const cdpSession = await context.newCDPSession(page);
      let touchRelease = await dragAndHold(cdpSession, {
        x: 100,
        y: 300,
        xDistance: 0,
        yDistance: -20,
      });
      await touchRelease();
      await wait(100);
      expect(
        await page.locator('x-view#content').getAttribute('style'),
      ).not.toContain('chartreuse');

      touchRelease = await dragAndHold(cdpSession, {
        x: 100,
        y: 300,
        xDistance: 0,
        yDistance: -200,
      });
      await touchRelease();
      await wait(100);
      expect(
        await page.locator('x-view#content').getAttribute('style'),
      ).toContain('chartreuse');
    });

    test('x-refresh-view/enable-auto-loadmore-true', async ({
      page,
      browserName,
      context,
    }, { title }) => {
      test.skip(browserName != 'chromium', 'cannot wheel');
      await gotoWebComponentPage(page, title);
      const cdpSession = await context.newCDPSession(page);
      let touchRelease = await dragAndHold(cdpSession, {
        x: 100,
        y: 300,
        xDistance: 0,
        yDistance: -20,
      });
      await touchRelease();
      await wait(100);
      expect(
        await page.locator('x-view#content').getAttribute('style'),
        'enable-auto-loadmore-true-swipe-slightly-will-trigger-the-event',
      ).toContain('chartreuse');
    });

    test('x-refresh-view/event-headerreleased', async ({
      page,
      browserName,
      context,
    }, { title }) => {
      test.skip(browserName != 'chromium', 'cannot wheel');
      await gotoWebComponentPage(page, title);
      const cdpSession = await context.newCDPSession(page);
      let touchRelease = await dragAndHold(cdpSession, {
        x: 100,
        y: 300,
        xDistance: 0,
        yDistance: 20,
      });
      await touchRelease();
      await wait(100);
      expect(
        await page.locator('x-view#content').getAttribute('style'),
        'pull slightly shouldnt trigger',
      ).not.toContain('chartreuse');
      touchRelease = await dragAndHold(cdpSession, {
        x: 100,
        y: 300,
        xDistance: 0,
        yDistance: 200,
      });
      await touchRelease();
      await wait(100);
      expect(
        await page.locator('x-view#content').getAttribute('style'),
        'pull down should trigger',
      ).toContain('chartreuse');
    });

    test('x-refresh-view/event-headeroffset', async ({
      page,
      browserName,
      context,
    }, { title }) => {
      test.skip(browserName != 'chromium', 'cannot wheel');
      await gotoWebComponentPage(page, title);
      const cdpSession = await context.newCDPSession(page);
      let touchRelease = await dragAndHold(cdpSession, {
        x: 100,
        y: 300,
        xDistance: 0,
        yDistance: -100,
      });
      await touchRelease();
      await wait(100);
      expect(
        await page.locator('x-view#content').getAttribute('style'),
        'pull up loadmore should not trigger',
      ).not.toContain('chartreuse');
      await swipe(cdpSession, {
        x: 100,
        y: 300,
        xDistance: 0,
        yDistance: 50,
      });
      touchRelease = await dragAndHold(cdpSession, {
        x: 100,
        y: 300,
        xDistance: 0,
        yDistance: 50,
      });
      await touchRelease();
      expect(
        await page.locator('x-view#content').getAttribute('style'),
        'pull slightly should trigger',
      ).toContain('chartreuse');
    });

    test('x-refresh-view/event-headershow', async ({
      page,
      browserName,
      context,
    }, { title }) => {
      test.skip(browserName != 'chromium', 'cannot wheel');
      await gotoWebComponentPage(page, title);
      const cdpSession = await context.newCDPSession(page);
      let touchRelease = await dragAndHold(cdpSession, {
        x: 100,
        y: 300,
        xDistance: 0,
        yDistance: -20,
      });
      await touchRelease();
      expect(
        await page.locator('x-view#content').getAttribute('style'),
        'pull down should not trigger',
      ).not.toContain('chartreuse');
      touchRelease = await dragAndHold(cdpSession, {
        x: 100,
        y: 300,
        xDistance: 0,
        yDistance: 150,
      });
      await touchRelease();
      await wait(100);
      expect(
        await page.locator('x-view#content').getAttribute('style'),
        'pull slightly should trigger',
      ).toContain('chartreuse');
    });

    test('x-refresh-view/event-footerreleased', async ({
      page,
      browserName,
      context,
    }, { title }) => {
      test.skip(browserName != 'chromium', 'cannot wheel');
      await gotoWebComponentPage(page, title);
      const cdpSession = await context.newCDPSession(page);
      let touchRelease = await dragAndHold(cdpSession, {
        x: 100,
        y: 300,
        xDistance: 0,
        yDistance: -30,
      });
      await touchRelease();
      await wait(100);
      expect(
        await page.locator('x-view#content').getAttribute('style'),
        'pull slightly shouldnt trigger',
      ).not.toContain('chartreuse');

      touchRelease = await dragAndHold(cdpSession, {
        x: 100,
        y: 300,
        xDistance: 0,
        yDistance: -300,
      });
      await touchRelease();
      await wait(100);
      expect(
        await page.locator('x-view#content').getAttribute('style'),
        'pull slightly should trigger',
      ).toContain('chartreuse');
    });
  });

  test.describe('x-swiper', () => {
    test(
      'x-swiper/x-swiper-initial-current',
      async ({ page, browserName, context }, {
        title,
      }) => {
        await gotoWebComponentPage(page, title);
        await wait(500);
        await diffScreenShot(page, title, 'initial');
      },
    );

    test(
      'x-swiper/x-swiper-basic-default-justify-content-flex-start',
      async ({ page, browserName, context }, {
        title,
      }) => {
        await gotoWebComponentPage(page, title);
        await wait(100);
        await expect(page.locator('x-view:has(#target)')).toHaveCSS(
          'justify-content',
          'center',
        );
        await expect(page.locator('#target')).toHaveCSS(
          'justify-content',
          'flex-start',
        );
      },
    );

    test(
      'x-swiper/x-swiper-set-current',
      async ({ page, browserName, context }, {
        title,
      }) => {
        await gotoWebComponentPage(page, title);
        await page.locator('#target').evaluate((dom) =>
          dom.setAttribute('current', '1')
        );
        await diffScreenShot(page, title, 'green');
      },
    );

    test(
      'x-swiper/x-swiper-set-curren-smooth-scroll',
      async ({ page, browserName, context }, {
        title,
      }) => {
        await gotoWebComponentPage(page, title);
        await wait(1000);
        const timeStampsPromise = await page
          .locator('x-swiper')
          .evaluateHandle((target) => {
            const values: number[] = [];
            values.push(Date.now());
            target.addEventListener('change', (e: any) => {
              if (e.detail.current === 12) {
                values.push(Date.now());
              }
            });
            return values;
          });
        await wait(200);
        await page.locator('#target').evaluate((dom) =>
          dom.setAttribute('current', '12')
        );
        await wait(1000);
        const timeStamps = await timeStampsPromise.jsonValue();
        const smoothScrollTime = timeStamps[1] - timeStamps[0];
        // calculate scrolltime without smooth
        await page.locator('#target').evaluate((dom) =>
          dom.setAttribute('smooth-scroll', 'false')
        );
        await page.locator('#target').evaluate((dom) =>
          dom.setAttribute('current', '0')
        );
        await wait(1000);
        const timeStampsPromiseWithoutSmooth = await page
          .locator('x-swiper')
          .evaluateHandle((target) => {
            const values: number[] = [];
            values.push(Date.now());
            target.addEventListener('change', (e: any) => {
              if (e.detail.current === 12) {
                values.push(Date.now());
              }
            });
            return values;
          });
        await wait(200);
        await page.locator('#target').evaluate((dom) =>
          dom.setAttribute('current', '12')
        );
        await wait(1000);
        const timeStampsWithoutSmooth = await timeStampsPromiseWithoutSmooth
          .jsonValue();
        const noSmoothScrollTime = timeStampsWithoutSmooth[1]
          - timeStampsWithoutSmooth[0];
        expect(noSmoothScrollTime).toBeLessThan(smoothScrollTime);
      },
    );

    test(
      'x-swiper/x-swiper-indicator-basic',
      async ({ page, browserName, context }, {
        title,
      }) => {
        await gotoWebComponentPage(page, title);
        await wait(500);
        await diffScreenShot(page, title, 'initial', {
          clip: {
            x: 50,
            width: 100,
            y: 170,
            height: 30,
          },
        });
        await page.locator('x-swiper').evaluate((dom) =>
          dom.setAttribute('current', '1')
        );
        await diffScreenShot(page, title, 'num-1-in-view', {
          clip: {
            x: 50,
            width: 100,
            y: 170,
            height: 30,
          },
        });
        await page.locator('x-swiper').evaluate((dom) =>
          dom.setAttribute('current', '2')
        );
        await diffScreenShot(page, title, 'num-2-in-view', {
          clip: {
            x: 50,
            width: 100,
            y: 170,
            height: 30,
          },
        });
        await page.locator('x-swiper').evaluate((dom) =>
          dom.setAttribute('current', '0')
        );
        await diffScreenShot(page, title, 'num-0-in-view', {
          clip: {
            x: 50,
            width: 100,
            y: 170,
            height: 30,
          },
        });
      },
    );

    test(
      'x-swiper/x-swiper-indicator-color',
      async ({ page, browserName, context }, {
        title,
      }) => {
        await gotoWebComponentPage(page, title);
        await wait(100);
        await diffScreenShot(page, title, 'inactivate-green', {
          clip: {
            x: 50,
            width: 100,
            y: 170,
            height: 30,
          },
        });
        await page.locator('x-swiper').evaluate((dom) =>
          dom.setAttribute('indicator-color', 'rgba(0,0,255,1)')
        );
        await diffScreenShot(page, title, 'inactivate-blue', {
          clip: {
            x: 50,
            width: 100,
            y: 170,
            height: 30,
          },
        });
      },
    );

    test(
      'x-swiper/x-swiper-indicator-active-color',
      async ({ page, browserName, context }, {
        title,
      }) => {
        await gotoWebComponentPage(page, title);
        await wait(100);
        await diffScreenShot(page, title, 'activate-green', {
          clip: {
            x: 50,
            width: 100,
            y: 170,
            height: 30,
          },
        });
        await page.locator('x-swiper').evaluate((dom) =>
          dom.setAttribute('indicator-active-color', 'rgba(0,0,255,1)')
        );
        await diffScreenShot(page, title, 'activate-blue', {
          clip: {
            x: 50,
            width: 100,
            y: 170,
            height: 30,
          },
        });
      },
    );

    test(
      'x-swiper/x-swiper-basic-autoplay',
      async ({ page, browserName, context }, {
        title,
      }) => {
        test.skip(browserName !== 'chromium');
        await gotoWebComponentPage(page, title);
        await wait(100);
        await diffScreenShot(page, title, 'initial-red');
        await wait(400);
        await diffScreenShot(page, title, 'red-not-changed');
        await wait(800);
        await diffScreenShot(page, title, 'autoplay-green');
        await wait(1000);
        await diffScreenShot(page, title, 'autoplay-blue');
      },
    );

    test(
      'x-swiper/x-swiper-basic-circular-autoplay',
      async ({ page, browserName, context }, {
        title,
      }) => {
        test.skip(browserName !== 'chromium');

        await gotoWebComponentPage(page, title);
        await wait(100);
        await diffScreenShot(page, title, 'initial-red');
        await wait(2200);
        await diffScreenShot(page, title, 'autoplay-blue');
        await wait(1000);
        await diffScreenShot(page, title, 'autoplay-circular-red');
      },
    );

    test(
      'x-swiper/x-swiper-basic-autoplay-interval',
      async ({ page, browserName, context }, {
        title,
      }) => {
        test.skip(browserName !== 'chromium');
        await gotoWebComponentPage(page, title);
        await wait(100);
        await diffScreenShot(page, title, 'initial-red');
        await wait(1000);
        await diffScreenShot(page, title, 'red-not-changed');
        await wait(800);
        await diffScreenShot(page, title, 'autoplay-green');
      },
    );

    test(
      'x-swiper/x-swiper-basic-circular',
      async ({ page, browserName, context }, {
        title,
      }) => {
        test.skip(
          browserName !== 'chromium',
          'using chromium only cdp methods',
        );
        const cdpSession = await context.newCDPSession(page);
        await gotoWebComponentPage(page, title);
        await wait(100);
        await swipe(cdpSession, {
          x: 100,
          y: 100,
          xDistance: 200,
          yDistance: 0,
        });
        await diffScreenShot(page, title, 'swipe-to-last-blue');
        await swipe(cdpSession, {
          x: 100,
          y: 100,
          xDistance: 200,
          yDistance: 0,
        });
        await swipe(cdpSession, {
          x: 100,
          y: 100,
          xDistance: 200,
          yDistance: 0,
        });
        await diffScreenShot(page, title, 'invert-swipe-to-first-red');
        await swipe(cdpSession, {
          x: 100,
          y: 100,
          xDistance: 200,
          yDistance: 0,
        });
        await diffScreenShot(page, title, 'circular-again-to-last-blue');
        await swipe(cdpSession, {
          x: 300,
          y: 100,
          xDistance: -200,
          yDistance: 0,
        });
        await diffScreenShot(page, title, 'swipe-back-to-first-red');
        await swipe(cdpSession, {
          x: 300,
          y: 100,
          xDistance: -200,
          yDistance: 0,
        });
        await diffScreenShot(page, title, 'swipe-to-show-mid-green');
        await swipe(cdpSession, {
          x: 300,
          y: 100,
          xDistance: -200,
          yDistance: 0,
        });
        await diffScreenShot(page, title, 'swipe-back-to-last-blue');
        await swipe(cdpSession, {
          x: 300,
          y: 100,
          xDistance: -200,
          yDistance: 0,
        });
        await diffScreenShot(page, title, 'circular-from-last-to-first-red');
      },
    );
    test(
      'x-swiper/x-swiper-circular-coverflow',
      async ({ page, browserName, context }, {
        title,
      }) => {
        test.skip(
          browserName !== 'chromium',
          'using chromium only cdp methods',
        );
        const cdpSession = await context.newCDPSession(page);
        await gotoWebComponentPage(page, title);
        await diffScreenShot(page, title, 'initial-mid-red-right-blue');
        await wait(100);
        await swipe(cdpSession, {
          x: 100,
          y: 100,
          xDistance: 200,
          yDistance: 0,
        });
        await diffScreenShot(page, title, 'swipe-to-last-blue');
        await swipe(cdpSession, {
          x: 100,
          y: 100,
          xDistance: 200,
          yDistance: 0,
        });
        await swipe(cdpSession, {
          x: 100,
          y: 100,
          xDistance: 200,
          yDistance: 0,
        });
        await diffScreenShot(page, title, 'invert-swipe-to-first-red');
        await swipe(cdpSession, {
          x: 100,
          y: 100,
          xDistance: 200,
          yDistance: 0,
        });
        await diffScreenShot(page, title, 'circular-again-to-last-blue');
        await swipe(cdpSession, {
          x: 300,
          y: 100,
          xDistance: -200,
          yDistance: 0,
        });
        await diffScreenShot(page, title, 'swipe-back-to-first-red');
        await swipe(cdpSession, {
          x: 300,
          y: 100,
          xDistance: -200,
          yDistance: 0,
        });
        await diffScreenShot(page, title, 'swipe-to-show-mid-green');
        await swipe(cdpSession, {
          x: 300,
          y: 100,
          xDistance: -200,
          yDistance: 0,
        });
        await diffScreenShot(page, title, 'swipe-back-to-last-blue');
        await swipe(cdpSession, {
          x: 300,
          y: 100,
          xDistance: -200,
          yDistance: 0,
        });
        await diffScreenShot(page, title, 'circular-from-last-to-first-red');
      },
    );

    test('x-swiper/x-swiper-circular-click', async ({ page }, { title }) => {
      await gotoWebComponentPage(page, title);
      await wait(100);

      await page.mouse.click(100, 25);
      expect(await page.getByText('目前计数为 1').count()).toBe(1);

      await page.mouse.click(100, 25);
      expect(await page.getByText('目前计数为 2').count()).toBe(1);

      await page.getByTestId('next').click();
      // default duration is 500ms, add 100ms tolerance
      await wait(1000);
      await page.mouse.click(100, 25);
      expect(await page.getByText('目前计数为 3').count()).toBe(1);
    });

    test(
      'x-swiper/x-swiper-current-change',
      async ({ page, context, browserName }, { title }) => {
        test.skip(browserName !== 'chromium', 'cannot swipe');
        await gotoWebComponentPage(page, title);
        await wait(100);
        await diffScreenShot(page, title, 'initial');
        const cdpSession = await context.newCDPSession(page);
        const touchRelease = await dragAndHold(cdpSession, {
          x: 180,
          y: 100,
          xDistance: -120,
          yDistance: 0,
        });
        await wait(1000);
        await page.evaluate(() => {
          document.querySelector('x-swiper')?.setAttribute('current', '1');
        });
        await wait(1000);
        await diffScreenShot(page, title, 'scroll');
        await touchRelease();
        await wait(1000);
        await diffScreenShot(page, title, 'scroll-end');
      },
    );
  });

  test.describe('x-textarea', () => {
    test('placeholder', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });

    test('placeholder-color', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });

    test('placeholder-weight', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });

    test(
      'attribute-value',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        await diffScreenShot(page, title, simpleTitle);
      },
    );

    test(
      'attribute-maxlength-first-screen-cut-value',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        await diffScreenShot(page, title, 'text-hello');
      },
    );

    test(
      'attribute-maxlength-change-do-not-change-value',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        await diffScreenShot(page, title, 'initial-10');
        await page.locator('#target').evaluate((dom) =>
          dom.setAttribute('maxlength', '5')
        );
        await diffScreenShot(page, title, 'maxlength-changed-still-10');
        await page.locator('#target').evaluate((dom) =>
          dom.setAttribute('value', '12345678')
        );
        await diffScreenShot(page, title, 'show-5');
      },
    );

    test(
      'press-enter-do-not-submit-value',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        await page.mouse.click(100, 25);
        await page.keyboard.type('hello');
        await diffScreenShot(page, title, 'show-hello');
        await page.keyboard.type('\n');
        await diffScreenShot(page, title, 'show-hello');
      },
    );

    test(
      'attribute-spell-check',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        const spellcheck = await page.locator('textarea').getAttribute(
          'spellcheck',
        );
        expect(spellcheck).toBe('true');
      },
    );

    test(
      'attribute-confirm-type-send',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        const attributeValue = await page.locator('textarea').getAttribute(
          'enterkeyhint',
        );
        expect(attributeValue).toBe('send');
      },
    );

    test(
      'attribute-confirm-type-search',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        const attributeValue = await page.locator('textarea').getAttribute(
          'enterkeyhint',
        );
        expect(attributeValue).toBe('search');
      },
    );

    test(
      'attribute-confirm-type-next',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        const attributeValue = await page.locator('textarea').getAttribute(
          'enterkeyhint',
        );
        expect(attributeValue).toBe('next');
      },
    );

    test(
      'attribute-confirm-type-go',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        const attributeValue = await page.locator('textarea').getAttribute(
          'enterkeyhint',
        );
        expect(attributeValue).toBe('go');
      },
    );

    test(
      'attribute-confirm-type-done',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        const attributeValue = await page.locator('textarea').getAttribute(
          'enterkeyhint',
        );
        expect(attributeValue).toBe('done');
      },
    );

    test(
      'attribute-disabled',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        await diffScreenShot(page, title, 'disabled');
        await page.mouse.click(100, 25);
        await page.keyboard.type('hello');
        await diffScreenShot(page, title, 'disabled');
      },
    );

    test(
      'attribute-readonly',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        await diffScreenShot(page, title, 'readonly');
        await page.mouse.click(100, 25);
        await page.keyboard.type('hello');
        await diffScreenShot(page, title, 'readonly');
      },
    );

    test('event-input', async ({ page }, { titlePath, title: simpleTitle }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await page.locator('textarea').click();
      await page.keyboard.type('foobar');
      await wait(100);
      const result = await page.locator('.result').first().innerText();
      expect(result).toBe('foobar');
    });

    test(
      'event-confirm',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        await page.mouse.click(100, 25);
        await page.keyboard.type('hello');
        const confirmValue = await page
          .locator('#target')
          .evaluateHandle((target) => {
            let detail = { value: undefined };
            target.addEventListener('confirm', (e) => {
              detail.value = (e as any).detail.value;
            });
            return detail;
          });
        await page.keyboard.type('\n');
        await wait(100);
        expect((await confirmValue.jsonValue()).value).toContain('hello');
      },
    );

    test(
      'event-focus-blur',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, title);
        const valuesPromise = await page
          .locator('#target')
          .evaluateHandle((target) => {
            let details: { value: undefined; eventType: string }[] = [];
            target.addEventListener('lynxfocus', (e) => {
              details.push({
                value: (e as any).detail.value,
                eventType: e.type,
              });
            });
            target.addEventListener('lynxblur', (e) => {
              details.push({
                value: (e as any).detail.value,
                eventType: e.type,
              });
            });
            return details;
          });
        await page.mouse.click(100, 25);
        await wait(500);
        await page.mouse.click(300, 325);
        await wait(500);
        const values = await valuesPromise.jsonValue();
        expect(values[0].value).toBe('hello');
        expect(values[0].eventType).toBe('lynxfocus');
        expect(values[1].value).toBe('hello');
        expect(values[1].eventType).toBe('lynxblur');
      },
    );

    test(
      'method-addText',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, 'x-input/method');
        await wait(100);
        await page
          .locator('#target')
          .evaluate((target: any) => {
            target.addText({
              text: 'add-text',
            });
          });
        await diffScreenShot(page, title, 'show-helloadd-text');
      },
    );

    test(
      'method-setValue',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, 'x-input/method');
        await wait(100);
        await page
          .locator('#target')
          .evaluate((target: any) => {
            target.setValue({
              value: 'add-text',
              index: 3,
            });
          });
        await page
          .locator('#target')
          .evaluate((target: any) => {
            target.addText({
              text: '3',
            });
          });
        await diffScreenShot(page, title, 'add3-text');
      },
    );

    test(
      'method-sendDelEvent',
      async ({ page }, { titlePath, title: simpleTitle }) => {
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, 'x-input/method');
        await wait(100);
        await page
          .locator('#target')
          .evaluate((target: any) => {
            target.sendDelEvent({
              action: 1,
            });
          });
        await diffScreenShot(page, title, 'hell');
        await page
          .locator('#target')
          .evaluate((target: any) => {
            target.sendDelEvent({
              action: 0,
              length: 2,
            });
          });
        await diffScreenShot(page, title, 'he');
      },
    );

    test(
      'method-select',
      async ({ page, browserName }, { titlePath, title: simpleTitle }) => {
        test.skip(
          browserName === 'chromium',
          'cannot demostrate the text is selected',
        );
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, 'x-input/method');
        await wait(100);
        await page
          .locator('#target')
          .evaluate((target: any) => {
            target.select();
          });
        await wait(100);
        await diffScreenShot(page, title, 'method-select');
      },
    );

    test(
      'method-setSelectionRange',
      async ({ page, browserName }, { titlePath, title: simpleTitle }) => {
        test.skip(
          browserName === 'firefox',
          'cannot demostrate the text is selected',
        );
        const title = getTitle(titlePath);
        await gotoWebComponentPage(page, 'x-input/method');
        await wait(100);
        await page
          .locator('#target')
          .evaluate((target: any) => {
            target.setSelectionRange({
              selectionStart: 2,
              selectionEnd: 4,
            });
          });
        await wait(100);
        await diffScreenShot(page, title, 'select-ll');
      },
    );

    test('background-color-inherit', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
    test('outline-color-inherit', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await diffScreenShot(page, title, 'index');
    });
  });

  test.describe('x-audio-tt', () => {
    test('attribute-src', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      // page.waitForSelector times out when executed in ci

      await page.waitForFunction(() => {
        const readyState = document.querySelector('x-audio-tt')?.shadowRoot
          ?.querySelector('audio')?.readyState;

        return typeof readyState === 'number' && readyState === 0;
      });
    });

    test('attribute-src-change', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await wait(200);
      // play
      await page.locator('#play').click();
      await wait(200);
      await expect(
        await page.evaluate(() =>
          document.querySelector('x-audio-tt')?.shadowRoot
            ?.querySelector('audio')?.paused
        ),
      ).toBeFalsy();

      // update src failed
      await page.locator('#fail').click();
      await wait(1000);
      await expect(
        await page.evaluate(() =>
          document.querySelector('x-audio-tt')?.shadowRoot
            ?.querySelector('audio')?.paused
        ),
      ).toBeTruthy();

      // update src success
      await page.locator('#success').click();
      await wait(1000);
      expect(
        await page.evaluate(() =>
          document.querySelector('x-audio-tt')?.shadowRoot
            ?.querySelector('audio')?.paused
        ),
      ).toBeTruthy();
    });

    test('attribute-loop', async ({ page, browserName }, { titlePath }) => {
      const title = getTitle(titlePath);
      test.skip(browserName === 'webkit', 'webkit dose not work on linux');
      await gotoWebComponentPage(page, title);
      await page.locator('#play').click();
      await wait(5000);
      expect(
        await page.evaluate(() =>
          document.querySelector('x-audio-tt')?.shadowRoot
            ?.querySelector('audio')?.paused
        ),
      ).toBeFalsy();
    });

    test('attribute-loop-close', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);

      await page.locator('#play').click();
      await wait(1000);
      await page.locator('#close').click();
      await wait(3000);
      expect(
        await page.evaluate(() =>
          document.querySelector('x-audio-tt')?.shadowRoot
            ?.querySelector('audio')?.paused
        ),
      ).toBeTruthy();
    });

    test('attribute-pause-on-hide', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);

      await page.locator('#play').click();
      await wait(6000);
      // Playwright has not yet provided an API for hiding pages, so mock visibilityState implementation
      // refer to: https://github.com/microsoft/playwright/issues/3570
      await page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', {
          value: 'hidden',
          writable: true,
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });

      await expect(
        await page.evaluate(() =>
          document.querySelector('x-audio-tt')?.shadowRoot
            ?.querySelector('audio')?.paused
        ),
      ).toBeTruthy();
      await expect(
        await page.evaluate(() =>
          document.querySelector('x-audio-tt')?.shadowRoot
            ?.querySelector('audio')?.currentTime
        ),
      ).not.toBe(0);
    });

    test('attribute-headers', async ({ page }, { titlePath }) => {
      await page.route('**/*.mp3', route => {
        const headers = route.request().headers();
        const userAgent = headers['custom-header'];
        expect(userAgent).toBe('test');
        route.continue();
      });

      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
    });

    test('attribute-interval', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);

      await page.locator('#play').click();

      let bindtimeupdate = 0;
      page.on('console', async (msg) => {
        const event = await msg.args()[0]?.evaluate((e) => ({
          type: e.type,
          detail: {
            currentTime: e?.detail?.currentTime,
            currentSrcID: e?.detail?.currentSrcID,
          },
        }));
        if (!event) return;
        if (
          event.detail.currentTime !== undefined
          && event.detail.currentTime !== 0
        ) {
          bindtimeupdate++;
        }
      });

      await wait(2500);
      expect(bindtimeupdate).toBe(2);
    });

    test('event-srcloadingstatechanged', async ({ page }, { titlePath }) => {
      // let loading = false;
      let success = false;
      page.on('console', async (msg) => {
        const event = await msg.args()[0]?.evaluate((e) => ({
          type: e.type,
          detail: {
            code: e?.detail?.code,
            currentSrcID: e?.detail?.currentSrcID,
          },
        }));
        if (!event) return;
        // if (event.detail.code === 0) {
        //   loading = true;
        // }
        if (event.detail.code === 1) {
          success = true;
        }
      });

      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);

      await page.locator('#play').click();
      await wait(100);
      // expect(loading).toBe(true);
      expect(success).toBe(true);
    });

    test('event-playbackstatechanged', async ({ page }, { titlePath }) => {
      let play = false;
      let stop = false;
      let pause = false;
      await page.on('console', async (msg) => {
        const event = await msg.args()[0]?.evaluate((e) => ({
          type: e.type,
          detail: {
            code: e?.detail?.code,
            currentSrcID: e?.detail?.currentSrcID,
          },
        }));
        if (!event) return;
        if (event.detail.code === 0) {
          stop = true;
        }
        if (event.detail.code === 1) {
          play = true;
        }
        if (event.detail.code === 2) {
          pause = true;
        }
      });

      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await wait(100);
      await page.locator('#play').click();
      await wait(200);
      expect(play).toBe(true);
      expect(pause).toBe(false);
      expect(stop).toBe(false);

      await page.locator('#pause').click();
      await wait(200);
      expect(pause).toBe(true);

      await page.locator('#stop').click();
      await wait(200);
      expect(stop).toBe(true);
    });

    test('event-finished', async ({ page }, { titlePath }) => {
      let finished = false;
      let isLoop = undefined;
      await page.on('console', async (msg) => {
        const event = await msg.args()[0]?.evaluate((e) => ({
          type: e.type,
          detail: {
            loop: e?.detail?.loop,
            currentSrcID: e?.detail?.currentSrcID,
          },
        }));
        if (event?.type === 'finished') {
          finished = true;
          isLoop = event.detail.loop;
        }
      });

      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await wait(1000);
      await page.locator('#play').click();
      await wait(4000);
      expect(finished).toBe(true);
      expect(isLoop).toBe(false);
    });

    test('event-seek', async ({ page }, { titlePath }) => {
      let seeked = false;
      page.on('console', async (msg) => {
        const event = await msg.args()[0]?.evaluate((e) => ({
          type: e.type,
          detail: {
            seekresult: e?.detail?.seekresult,
            currentSrcID: e?.detail?.currentSrcID,
          },
        }));
        if (!event) return;
        if (event.detail.seekresult === 1) {
          seeked = true;
        }
      });

      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);

      await page.locator('#play').click();
      await wait(1000);
      await page.locator('#seek').click();
      await wait(1000);
      expect(seeked).toBe(true);
    });

    test('event-error-src', async ({ page }, { titlePath }) => {
      let error = false;
      page.on('console', async (msg) => {
        const code = await msg.args()[0]?.evaluate(e => e?.detail?.code);
        if (code === -1) {
          error = true;
        }
      });

      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);

      await page.locator('#change').click();
      await wait(1000);
      expect(error).toBe(true);
    });

    test('event-error-src-json', async ({ page }, { titlePath }) => {
      let error = false;
      page.on('console', async (msg) => {
        const code = await msg.args()[0]?.evaluate(e => e?.detail?.code);
        if (code === -2) {
          error = true;
        }
      });

      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);

      await page.locator('#change').click();
      await wait(1000);
      expect(error).toBe(true);
    });

    test('event-error-playback', async ({ page }, { titlePath }) => {
      let error = false;
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      page.on('console', async (msg) => {
        if (!error) {
          const code = await msg.args()[0]?.evaluate(e => e?.detail?.code);
          if (code === -6) {
            error = true;
          }
        }
      });
      await wait(50);

      await page.locator('#play').click();
      await wait(1000);
      expect(error).toBe(true);
    });

    test('method-play', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);

      expect(
        await page.evaluate(() =>
          document.querySelector('x-audio-tt')?.shadowRoot
            ?.querySelector('audio')?.paused
        ),
      ).toBeTruthy();
      await page.locator('#play').click();
      await wait(100);
      await expect(
        await page.evaluate(() =>
          document.querySelector('x-audio-tt')?.shadowRoot
            ?.querySelector('audio')?.paused
        ),
      ).toBeFalsy();
    });

    test('method-stop', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);

      await page.locator('#play').click();
      await wait(2000);

      await page.locator('#stop').click();
      await expect(
        await page.evaluate(() =>
          document.querySelector('x-audio-tt')?.shadowRoot
            ?.querySelector('audio')?.paused
        ),
      ).toBeTruthy();
      await expect(
        await page.evaluate(() =>
          document.querySelector('x-audio-tt')?.shadowRoot
            ?.querySelector('audio')?.currentTime
        ),
      ).toBe(0);
    });

    test('method-pause', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);

      await page.locator('#play').click();
      await wait(2000);

      await page.locator('#pause').click();
      await expect(
        await page.evaluate(() =>
          document.querySelector('x-audio-tt')?.shadowRoot
            ?.querySelector('audio')?.paused
        ),
      ).toBeTruthy();
      await expect(
        await page.evaluate(() =>
          document.querySelector('x-audio-tt')?.shadowRoot
            ?.querySelector('audio')?.currentTime
        ),
      ).not.toBe(0);
    });

    test('method-resume', async ({ page, browserName }, { titlePath }) => {
      test.skip(browserName === 'webkit', 'webkit dose not work on linux');
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);

      await page.locator('#play').click();
      await wait(200);
      expect(
        await page.evaluate(() =>
          document.querySelector('x-audio-tt')?.shadowRoot
            ?.querySelector('audio')?.paused
        ),
      ).toBeFalsy();
      await page.locator('#pause').click();
      await wait(200);
      expect(
        await page.evaluate(() =>
          document.querySelector('x-audio-tt')?.shadowRoot
            ?.querySelector('audio')?.paused
        ),
      ).toBeTruthy();
      await page.locator('#resume').click();
      expect(
        await page.evaluate(() =>
          document.querySelector('x-audio-tt')?.shadowRoot
            ?.querySelector('audio')?.paused
        ),
      ).toBeFalsy();
    });

    test('method-seek', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);

      await page.locator('#play').click();
      await page.locator('#seek').click();
      await wait(3000);
      expect(
        await page.evaluate(() =>
          document.querySelector('x-audio-tt')?.shadowRoot
            ?.querySelector('audio')?.paused
        ),
      ).toBeTruthy();
    });

    test('method-mute', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);

      await page.locator('#mute').click();
      await wait(3000);
      expect(
        await page.evaluate(() =>
          document.querySelector('x-audio-tt')?.shadowRoot
            ?.querySelector('audio')?.muted
        ),
      ).toBeTruthy();
    });

    test('method-player-info', async ({ page, browserName }, { titlePath }) => {
      test.skip(browserName === 'webkit', 'webkit dose not work on linux');
      let currentTime = 0;
      let currentSrcID = '';
      let duration = 0;
      let playbackState = 0;
      let cacheTime = 0;
      page.on('console', async (msg) => {
        const event = await msg.args()[0]?.evaluate((e) => ({
          type: e.type,
          detail: {
            currentTime: e?.currentTime,
            currentSrcID: e?.currentSrcID,
            duration: e?.duration,
            playbackState: e?.playbackState,
            cacheTime: e?.cacheTime,
          },
        }));
        if (!event) return;

        currentTime = event.detail.currentTime;
        currentSrcID = event.detail.currentSrcID;
        duration = event.detail.duration;
        playbackState = event.detail.playbackState;
        cacheTime = event.detail.cacheTime;
      });

      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);

      await page.locator('#play').click();
      await wait(3000);
      await page.locator('#playerInfo').click();
      await wait(1000);

      expect(currentTime).toBeGreaterThan(0);
      expect(currentSrcID).not.toBe('');
      expect(duration).toBeGreaterThan(0);
      expect(playbackState).not.toBe(0);
      expect(cacheTime).toBeGreaterThan(0);
    });

    test('method-prepare', async ({ page }, { titlePath }) => {
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);
      await wait(100);

      await page.locator('#prepare').click();
      await wait(1000);
      expect(await page.getByText('audio can play').count()).toBe(1);
      await page.locator('#play').click();
      await wait(500);
      await expect(
        await page.evaluate(() =>
          document.querySelector('x-audio-tt')?.shadowRoot
            ?.querySelector('audio')?.paused
        ),
      ).toBeFalsy();
    });

    test('method-set-volume', async ({ page, browserName }, { titlePath }) => {
      test.skip(browserName === 'webkit', 'webkit dose not work on linux');
      const title = getTitle(titlePath);
      await gotoWebComponentPage(page, title);

      await page.locator('#play').click();
      await page.locator('#setVolume').click();
      expect(
        await page.evaluate(() =>
          document.querySelector('x-audio-tt')?.shadowRoot
            ?.querySelector('audio')?.volume
        ),
      ).toBe(0.5);
    });
  });
});
