// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { test, expect } from '@lynx-js/playwright-fixtures';
import type { Page } from '@playwright/test';

const wait = async (ms: number) => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const goto = async (page: Page, fixtureName: string) => {
  await page.goto(`/tests/fixtures/${fixtureName}.html`, {
    waitUntil: 'load',
  });
  await page.evaluate(() => document.fonts.ready);
};

test.describe('x-foldview-ng wheel', () => {
  test('x-foldview-ng/wheel-parent-first', async ({ page, browserName }, {
    title,
  }) => {
    test.skip(browserName === 'webkit', 'mouse wheel unsupported on webkit');
    await goto(page, title);
    await wait(200);
    const scrollview = page.locator('#inner-scroll');
    await page.locator('#inner-scroll').hover({
      force: true,
      position: { x: 50, y: 50 },
    });

    const foldviewInitial = await page.evaluate(() =>
      (document.querySelector('#foldview') as HTMLElement).scrollTop
    );
    const scrollViewInitial = await page.evaluate(() =>
      (document.querySelector('#inner-scroll') as HTMLElement).scrollTop
    );

    await page.mouse.wheel(0, 120);
    await wait(200);

    expect(
      await page.evaluate(() =>
        (document.querySelector('#foldview') as HTMLElement).scrollTop
      ),
      'wheel-outer-scrolls-first',
    ).toBeGreaterThan(foldviewInitial);
    expect(
      await page.evaluate(() =>
        (document.querySelector('#inner-scroll') as HTMLElement).scrollTop
      ),
      'wheel-inner-not-scrolled-before-header',
    ).toBe(scrollViewInitial);
  });

  test('x-foldview-ng/wheel-smooth-continue', async ({ page, browserName }, {
    title,
  }) => {
    test.skip(browserName === 'webkit', 'mouse wheel unsupported on webkit');
    await goto(page, title);
    await wait(200);
    const scrollview = page.locator('#inner-scroll');
    await page.locator('#inner-scroll').hover({
      force: true,
      position: { x: 50, y: 50 },
    });

    await page.evaluate(() => {
      const foldview = document.querySelector('#foldview') as HTMLElement;
      const scrollview = document.querySelector('#inner-scroll') as HTMLElement;
      foldview.scrollTop = 0;
      scrollview.scrollTop = 0;
      foldview.scrollTop = foldview.scrollHeight;
    });
    await wait(100);

    const foldviewBeforeInner = await page.evaluate(() =>
      (document.querySelector('#foldview') as HTMLElement).scrollTop
    );
    await page.mouse.wheel(0, 200);
    await wait(200);

    expect(
      await page.evaluate(() =>
        (document.querySelector('#inner-scroll') as HTMLElement).scrollTop
      ),
      'wheel-continues-to-inner-scroll',
    ).toBeGreaterThan(0);
    expect(
      await page.evaluate(() =>
        (document.querySelector('#foldview') as HTMLElement).scrollTop
      ),
      'wheel-outer-stays-at-end',
    ).toBeGreaterThanOrEqual(foldviewBeforeInner);
  });

  test('x-foldview-ng/wheel-overflow-visible-child', async ({
    page,
    browserName,
  }, {
    title,
  }) => {
    test.skip(browserName === 'webkit', 'mouse wheel unsupported on webkit');
    await goto(page, title);
    const foldview = page.locator('#foldview');
    const scrollview = page.locator('#inner-scroll');
    const overflowVisibleWrapper = page.locator('#overflow-visible-wrapper');

    // Scroll the foldview header fully away
    await foldview.evaluate((dom: HTMLElement) => {
      dom.scrollTop = dom.scrollHeight;
    });
    await wait(100);

    // Hover over the overflow:visible wrapper (inside scroll-view)
    await overflowVisibleWrapper.hover();

    // Reset scroll positions
    await scrollview.evaluate((dom: HTMLElement) => {
      dom.scrollTop = 0;
    });

    // Wheel down over the overflow:visible area
    await page.mouse.wheel(0, 200);
    await wait(200);

    // The scroll-view should scroll, not the overflow:visible wrapper
    expect(
      await scrollview.evaluate((dom: HTMLElement) => dom.scrollTop),
      'scroll-view-should-scroll-not-overflow-visible-wrapper',
    ).toBeGreaterThan(0);
  });
});
