// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { swipe, dragAndHold } from './utils.js';
import { test, expect } from './coverage-fixture.js';
import type { Page } from '@playwright/test';
import type { LynxView } from '../../web-core/src/index.js';
const ENABLE_MULTI_THREAD = !!process.env['ENABLE_MULTI_THREAD'];
const isSSR = !!process.env['ENABLE_SSR'];

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

const goto = async (
  page: Page,
  testname: string,
) => {
  let url = `middleware?casename=/dist/${testname}/index.web.json`;
  await page.goto(url, {
    waitUntil: 'load',
  });
  await page.evaluate(() => document.fonts.ready);
};

test.describe('middleware tests', () => {
  test.skip(ENABLE_MULTI_THREAD || isSSR, 'skip multi-thread and ssr');
  test.beforeEach(async ({ browserName }) => {
    test.skip(browserName !== 'chromium', 'only run in chromium');
  });

  test('basic-bindtap', async ({ page }, { title }) => {
    await goto(page, title);
    await wait(100);
    const target = page.locator('#target');
    await target.click();
    await wait(100);
    await expect(await target.getAttribute('style')).toContain('green');
    await target.click();
    await wait(100);
    await expect(await target.getAttribute('style')).toContain('pink');
  });
});
