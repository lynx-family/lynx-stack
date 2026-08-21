// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expect, test } from '@lynx-js/playwright-fixtures';
import type { Locator, Page } from '@playwright/test';

const goto = async (page: Page) => {
  await page.goto('/tests/fixtures/scroll-view/mouse-drag.html', {
    waitUntil: 'load',
  });
  await page.evaluate(() => document.fonts.ready);
};

const drag = async (
  page: Page,
  target: Locator,
  delta: { x: number; y: number },
) => {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  if (!box) {
    return;
  }

  const start = {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(start.x + delta.x, start.y + delta.y, { steps: 5 });
  await page.mouse.up({ button: 'left' });
};

const scrollOffset = (target: Locator) =>
  target.evaluate((element: HTMLElement) => ({
    left: element.scrollLeft,
    top: element.scrollTop,
  }));

test.describe('scroll-view mouse drag', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page);
  });

  test('drags vertical, horizontal and both orientations like a touchscreen', async ({ page }) => {
    const vertical = page.locator('#vertical');
    await drag(page, vertical, { x: -60, y: -80 });
    expect(await scrollOffset(vertical)).toEqual({
      left: 0,
      top: expect.any(Number),
    });
    expect((await scrollOffset(vertical)).top).toBeGreaterThan(0);

    const horizontal = page.locator('#horizontal');
    await drag(page, horizontal, { x: -80, y: -60 });
    expect(await scrollOffset(horizontal)).toEqual({
      left: expect.any(Number),
      top: 0,
    });
    expect((await scrollOffset(horizontal)).left).toBeGreaterThan(0);

    const both = page.locator('#both');
    await drag(page, both, { x: -80, y: -60 });
    const bothOffset = await scrollOffset(both);
    expect(bothOffset.left).toBeGreaterThan(0);
    expect(bothOffset.top).toBeGreaterThan(0);

    const rtl = page.locator('#rtl');
    await drag(page, rtl, { x: 80, y: 0 });
    expect(Math.abs((await scrollOffset(rtl)).left)).toBeGreaterThan(0);
  });

  test('does not drag when scrolling is disabled', async ({ page }) => {
    const disabled = page.locator('#disabled');
    await drag(page, disabled, { x: 0, y: -80 });

    await expect.poll(() => scrollOffset(disabled)).toEqual({
      left: 0,
      top: 0,
    });
  });

  test('only drags the nearest scrollable scroll-view', async ({ page }) => {
    const outer = page.locator('#outer');
    const inner = page.locator('#inner');
    await drag(page, inner, { x: 0, y: -80 });

    expect((await scrollOffset(inner)).top).toBeGreaterThan(0);
    expect(await scrollOffset(outer)).toEqual({ left: 0, top: 0 });
  });

  test('selects the nested scroll-view chain by drag direction', async ({ page }) => {
    const outer = page.locator('#cross-outer');
    const inner = page.locator('#cross-inner');

    await drag(page, inner, { x: 0, y: -80 });
    expect((await scrollOffset(outer)).top).toBeGreaterThan(0);
    expect((await scrollOffset(inner)).left).toBe(0);

    await outer.evaluate((element) => element.scrollTop = 0);
    await drag(page, inner, { x: -80, y: 0 });
    expect((await scrollOffset(inner)).left).toBeGreaterThan(0);
    expect((await scrollOffset(outer)).top).toBe(0);

    await inner.evaluate((element) => element.scrollLeft = 0);
    await drag(page, inner, { x: -80, y: -80 });
    expect((await scrollOffset(inner)).left).toBeGreaterThan(0);
    expect((await scrollOffset(outer)).top).toBe(0);
  });

  test('chains unused drag distance to an outer scroll-view at a boundary', async ({ page }) => {
    const outer = page.locator('#outer');
    const inner = page.locator('#inner');
    await inner.scrollIntoViewIfNeeded();
    await outer.evaluate((element) => element.scrollTop = 0);
    const maxScrollTop = await inner.evaluate((element) => {
      const maximum = element.scrollHeight - element.clientHeight;
      element.scrollTop = maximum - 20;
      return maximum;
    });

    await drag(page, inner, { x: 0, y: -80 });

    expect((await scrollOffset(inner)).top).toBe(maxScrollTop);
    expect((await scrollOffset(outer)).top).toBeGreaterThan(0);
  });

  test('scrolls instantly when scroll-behavior is smooth', async ({ page }) => {
    const outer = page.locator('#outer');
    const inner = page.locator('#inner');
    await inner.scrollIntoViewIfNeeded();
    await outer.evaluate((element) => element.scrollTop = 0);
    await inner.evaluate((element) => {
      element.scrollTop = 0;
      element.style.scrollBehavior = 'smooth';
    });

    await drag(page, inner, { x: 0, y: -80 });

    expect((await scrollOffset(inner)).top).toBe(80);
    expect((await scrollOffset(outer)).top).toBe(0);
  });

  test('recomputes the whole scroll chain when a drag reverses direction', async ({ page }) => {
    const outer = page.locator('#outer');
    const inner = page.locator('#inner');
    await inner.scrollIntoViewIfNeeded();
    await outer.evaluate((element) => element.scrollTop = 0);
    const startScrollTop = await inner.evaluate((element) => {
      const start = element.scrollHeight - element.clientHeight - 20;
      element.scrollTop = start;
      return start;
    });
    const box = await inner.boundingBox();
    expect(box).not.toBeNull();
    if (!box) {
      return;
    }
    const start = {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    };

    await page.mouse.move(start.x, start.y);
    await page.mouse.down({ button: 'left' });
    await page.mouse.move(start.x, start.y - 80, { steps: 5 });
    await page.mouse.move(start.x, start.y - 10, { steps: 5 });
    await page.mouse.up({ button: 'left' });

    expect((await scrollOffset(inner)).top).toBe(startScrollTop + 10);
    expect((await scrollOffset(outer)).top).toBe(0);
  });

  test('honors overscroll-behavior when chaining nested scroll-views', async ({ page }) => {
    const outer = page.locator('#contained-outer');
    const inner = page.locator('#contained-inner');
    await inner.scrollIntoViewIfNeeded();
    await outer.evaluate((element) => element.scrollTop = 0);
    const maxScrollTop = await inner.evaluate((element) => {
      const maximum = element.scrollHeight - element.clientHeight;
      element.scrollTop = maximum - 20;
      return maximum;
    });

    await drag(page, inner, { x: 0, y: -80 });

    expect((await scrollOffset(inner)).top).toBe(maxScrollTop);
    expect((await scrollOffset(outer)).top).toBe(0);
  });

  test('suppresses a click after dragging but preserves an ordinary click', async ({ page }) => {
    const clickTarget = page.locator('#click-target');
    await clickTarget.click();
    await expect(page.locator('#click-count')).toHaveText('1');
    await expect(page.locator('#document-click-count')).toHaveText('1');

    await drag(page, clickTarget, { x: 0, y: -40 });
    await expect(page.locator('#click-count')).toHaveText('1');
    await expect(page.locator('#document-click-count')).toHaveText('1');
    expect((await scrollOffset(page.locator('#clickable'))).top)
      .toBeGreaterThan(0);
  });

  test('still supports dragging after being disconnected and reconnected', async ({ page }) => {
    const reconnectable = page.locator('#reconnectable');
    await reconnectable.evaluate((element) => {
      const parent = element.parentElement;
      element.remove();
      parent?.append(element);
    });

    await drag(page, reconnectable, { x: 0, y: -80 });
    expect((await scrollOffset(reconnectable)).top).toBeGreaterThan(0);
  });
});

test('mouse dragging remains opt-in', async ({ page }) => {
  await page.goto('/tests/fixtures/scroll-view/mouse-drag-no-plugin.html', {
    waitUntil: 'load',
  });
  const target = page.locator('#without-plugin');
  expect(
    await target.evaluate((element) =>
      element.scrollHeight > element.clientHeight
    ),
  ).toBe(true);

  await drag(page, target, { x: 0, y: -80 });

  expect(await scrollOffset(target)).toEqual({ left: 0, top: 0 });
});
