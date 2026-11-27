// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Page } from '@playwright/test';

import { expect, test } from './coverage.js';
import { kitApi, loadKit } from './harness.js';

const channel = 'lynx-web-preview';

/**
 * Posts `connect` to `target` from the page with a new port, sends
 * `project.close` on it and resolves to whether an answer came within a
 * second.
 */
function connectAndAsk(page: Page, target: 'self' | 'popup') {
  return page.evaluate(async ({ channel, target }) => {
    const { port1, port2 } = new MessageChannel();
    const answered = new Promise<boolean>((resolve) => {
      port1.onmessage = () => resolve(true);
      setTimeout(() => resolve(false), 1000);
    });
    const targetWindow = target === 'self'
      ? window
      : (window as unknown as { popup: Window }).popup;
    targetWindow.postMessage({ channel, type: 'connect' }, '*', [port2]);
    port1.postMessage({ id: 1, method: 'project.close' });
    return answered;
  }, { channel, target });
}

test('the kit posts ready once and accepts one connect', async ({ page }) => {
  await loadKit(page);
  await page.evaluate(() => window.kit.connect());
  const kit = kitApi(page);
  expect(await kit.respond('project.close')).toEqual({
    id: 1,
    result: undefined,
  });
  expect(await page.evaluate(() => window.kit.readies)).toEqual([
    { channel, type: 'ready' },
  ]);
  // A second connect is ignored.
  expect(await connectAndAsk(page, 'self')).toBe(false);
});

test('another window cannot connect', async ({ page }) => {
  await loadKit(page);
  const popupOpened = page.waitForEvent('popup');
  await page.evaluate(() => {
    (window as unknown as { popup: Window | null }).popup = window.open('/');
  });
  const popup = await popupOpened;
  await popup.waitForLoadState('load');
  expect(await connectAndAsk(page, 'popup')).toBe(false);
  // The popup's own scripts still can.
  await popup.evaluate(() => window.kit.connect());
  expect(await kitApi(popup).respond('project.close')).toEqual({
    id: 1,
    result: undefined,
  });
});
