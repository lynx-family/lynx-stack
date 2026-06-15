// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { test, expect } from '@lynx-js/playwright-fixtures';
import type { Page } from '@playwright/test';

const isSSR = !!process.env['ENABLE_SSR'];

const wait = async (ms: number) => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const goto = async (page: Page, testname: string) => {
  const url = isSSR ? `/ssr?casename=${testname}` : `/?casename=${testname}`;
  await page.goto(url, {
    waitUntil: 'load',
  });
  await page.evaluate(() => document.fonts.ready);
  if (isSSR) await wait(300);
};

test.describe('reactlynx3 tests', () => {
  test.describe('basic-css', () => {
    test(
      'basic-css-var-fallback-background-color',
      async ({ page }, { title }) => {
        await goto(page, title);
        await wait(100);
        await expect(page.locator('#target')).toHaveCSS(
          'background-color',
          'rgb(0, 128, 0)',
        );
      },
    );

    test(
      'basic-css-var-nested-fallback-background-color',
      async ({ page }, { title }) => {
        await goto(page, title);
        await wait(100);
        await expect(page.locator('#target')).toHaveCSS(
          'background-color',
          'rgb(0, 128, 0)',
        );
      },
    );
  });
});
