// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { test, expect } from '@lynx-js/playwright-fixtures';
import type { Page } from '@playwright/test';

const goto = async (page: Page) => {
  await page.goto('tests/fixtures/x-blur-view/basic.html', {
    waitUntil: 'load',
  });
  await page.evaluate(() => document.fonts.ready);
};

test('blur radius preserves units and responds to unit changes', async ({ page }) => {
  await goto(page);
  const view = page.locator('x-blur-view');
  await expect(view).toHaveCSS('backdrop-filter', 'blur(25px)');
  await view.evaluate(el => {
    el.style.fontSize = '10px';
    el.style.setProperty('--rpx-unit', '0.5px');
    el.style.setProperty('--ppx-unit', '0.25px');
  });
  for (
    const [radius, expected] of [
      ['12.5px', '12.5px'],
      ['2em', '20px'],
      ['20rpx', '10px'],
      ['20ppx', '5px'],
      ['0', '0px'],
      [' 8 ', '8px'],
    ]
  ) {
    await view.evaluate(
      (el, value) => el.setAttribute('blur-radius', value!),
      radius,
    );
    await expect(view).toHaveCSS('backdrop-filter', `blur(${expected})`);
  }
  await view.evaluate(el => el.setAttribute('blur-radius', '20rpx'));
  await expect(view).toHaveCSS('backdrop-filter', 'blur(10px)');
  await view.evaluate(el => el.style.setProperty('--rpx-unit', '0.75px'));
  await expect(view).toHaveCSS('backdrop-filter', 'blur(15px)');
  await expect(view).toHaveCSS('filter', 'none');
});

test('removing or invalidating blur radius clears the previous blur', async ({ page }) => {
  await goto(page);
  const view = page.locator('x-blur-view');
  for (
    const radius of [
      '',
      '-1px',
      'NaN',
      'Infinity',
      '1e999px',
      '12garbage',
      '10%',
      '2px) brightness(0)',
    ]
  ) {
    await view.evaluate(el => el.setAttribute('blur-radius', '8px'));
    await expect(view).toHaveCSS('backdrop-filter', 'blur(8px)');
    await view.evaluate(
      (el, value) => el.setAttribute('blur-radius', value),
      radius,
    );
    await expect(view).toHaveCSS('backdrop-filter', 'none');
  }
  await view.evaluate(el => el.setAttribute('blur-radius', '8px'));
  await expect(view).toHaveCSS('backdrop-filter', 'blur(8px)');
  await view.evaluate(el => el.removeAttribute('blur-radius'));
  await expect(view).toHaveCSS('backdrop-filter', 'none');
});
