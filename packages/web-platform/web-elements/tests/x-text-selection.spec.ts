// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { expect, test } from '@lynx-js/playwright-fixtures';
import type { Page } from '@playwright/test';

const goto = async (page: Page) => {
  await page.goto('/tests/fixtures/x-text/selectionchange.html', {
    waitUntil: 'load',
  });
};

const selectInlineText = async (
  page: Page,
  anchorOffset: number,
  focusOffset: number,
) => {
  await page.evaluate(({ anchorOffset, focusOffset }) => {
    const inlineText = document.querySelector('#inline-text')!;
    const textNode = inlineText.querySelector('raw-text')!.firstChild!;
    const selection = document.getSelection()!;
    selection.setBaseAndExtent(
      textNode,
      anchorOffset,
      textNode,
      focusOffset,
    );
    document.dispatchEvent(new Event('selectionchange'));
  }, { anchorOffset, focusOffset });
};

test.describe('x-text selectionchange', () => {
  test('reports selection offsets and direction for x-text and inline-text', async ({ page }) => {
    await goto(page);

    await page.evaluate(() => {
      (window as any).textDetails = [];
      (window as any).inlineTextDetails = [];
      document.querySelector('#text')!.addEventListener(
        'selectionchange',
        (event) =>
          (window as any).textDetails.push((event as CustomEvent).detail),
      );
      document.querySelector('#inline-text')!.addEventListener(
        'selectionchange',
        (event) =>
          (window as any).inlineTextDetails.push(
            (event as CustomEvent).detail,
          ),
      );
    });
    const getDetails = () =>
      page.evaluate(() => ({
        textDetails: (window as any).textDetails,
        inlineTextDetails: (window as any).inlineTextDetails,
      }));

    await selectInlineText(page, 1, 4);
    await expect.poll(async () => (await getDetails()).textDetails.length)
      .toBe(1);
    let details = await getDetails();
    expect(details.textDetails).toEqual([
      { start: 7, end: 10, direction: 'forward' },
    ]);
    expect(details.inlineTextDetails).toEqual([
      { start: 1, end: 4, direction: 'forward' },
    ]);

    await selectInlineText(page, 4, 1);
    await expect.poll(async () => (await getDetails()).textDetails.length)
      .toBe(2);
    details = await getDetails();
    expect(details.textDetails[1]).toEqual({
      start: 7,
      end: 10,
      direction: 'backward',
    });
    expect(details.inlineTextDetails[1]).toEqual({
      start: 1,
      end: 4,
      direction: 'backward',
    });

    await page.evaluate(() => {
      document.getSelection()!.removeAllRanges();
      document.dispatchEvent(new Event('selectionchange'));
    });
    await expect.poll(async () => (await getDetails()).textDetails.length)
      .toBe(3);
    details = await getDetails();
    expect(details.textDetails[2]).toEqual({
      start: -1,
      end: -1,
      direction: 'forward',
    });
    expect(details.inlineTextDetails[2]).toEqual({
      start: -1,
      end: -1,
      direction: 'forward',
    });
  });

  test('stops listening after the event is unbound', async ({ page }) => {
    await goto(page);

    await page.evaluate(() => {
      const text = document.querySelector('#text')!;
      let count = 0;
      const listener = () => count++;
      text.addEventListener('selectionchange', listener);
      (window as any).removeSelectionChangeListener = () =>
        text.removeEventListener('selectionchange', listener);
      (window as any).getSelectionChangeCount = () => count;
    });

    await page.evaluate(() => (window as any).removeSelectionChangeListener());
    await selectInlineText(page, 1, 4);
    expect(
      await page.evaluate(() => (window as any).getSelectionChangeCount()),
    ).toBe(0);
  });
});
