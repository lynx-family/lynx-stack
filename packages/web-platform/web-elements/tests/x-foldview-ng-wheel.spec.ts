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
    const foldview = page.locator('#foldview');
    const scrollview = page.locator('#inner-scroll');
    await page.locator('#inner-scroll').hover();

    await foldview.evaluate((dom: HTMLElement) => {
      dom.scrollTop = 0;
    });
    await scrollview.evaluate((dom: HTMLElement) => {
      dom.scrollTop = 0;
    });

    const foldviewInitial = await foldview.evaluate((dom: HTMLElement) =>
      dom.scrollTop
    );
    const scrollViewInitial = await scrollview.evaluate((dom: HTMLElement) =>
      dom.scrollTop
    );

    await page.mouse.wheel(0, 120);
    await wait(200);

    expect(
      await foldview.evaluate((dom: HTMLElement) => dom.scrollTop),
      'wheel-outer-scrolls-first',
    ).toBeGreaterThan(foldviewInitial);
    expect(
      await scrollview.evaluate((dom: HTMLElement) => dom.scrollTop),
      'wheel-inner-not-scrolled-before-header',
    ).toBe(scrollViewInitial);
  });

  test('x-foldview-ng/wheel-smooth-continue', async ({ page, browserName }, {
    title,
  }) => {
    test.skip(browserName === 'webkit', 'mouse wheel unsupported on webkit');
    await goto(page, title);
    const foldview = page.locator('#foldview');
    const scrollview = page.locator('#inner-scroll');
    await page.locator('#inner-scroll').hover();

    await foldview.evaluate((dom: HTMLElement) => {
      dom.scrollTop = 0;
    });
    await scrollview.evaluate((dom: HTMLElement) => {
      dom.scrollTop = 0;
    });

    await foldview.evaluate((dom: HTMLElement) => {
      dom.scrollTop = dom.scrollHeight;
    });
    await wait(100);

    const foldviewBeforeInner = await foldview.evaluate((dom: HTMLElement) =>
      dom.scrollTop
    );
    await page.mouse.wheel(0, 200);
    await wait(200);

    expect(
      await scrollview.evaluate((dom: HTMLElement) => dom.scrollTop),
      'wheel-continues-to-inner-scroll',
    ).toBeGreaterThan(0);
    expect(
      await foldview.evaluate((dom: HTMLElement) => dom.scrollTop),
      'wheel-outer-stays-at-end',
    ).toBeGreaterThanOrEqual(foldviewBeforeInner);
  });
});
