// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0. See LICENSE.
import { expect, test } from '@lynx-js/playwright-fixtures';
import type { Page } from '@playwright/test';

const goto = async (page: Page) => {
  await page.goto('/tests/fixtures/x-text/whitespace.html', {
    waitUntil: 'load',
  });
  await page.evaluate(() => document.fonts.ready);
};

for (const backend of ['raw-text', 'direct-text', 'attribute']) {
  test(`${backend} preserves whitespace text line height and advances`, async ({ page }) => {
    await goto(page);
    const measurements = await page.locator(
      `.probe[data-backend="${backend}"]`,
    ).evaluateAll(containers =>
      containers.map(container => {
        const [before, middle, after] = Array.from(container.children);
        const range = document.createRange();
        range.selectNodeContents(middle!.firstChild!);
        return {
          sample: (container as HTMLElement).dataset['sample'],
          text: middle!.textContent,
          height: middle!.getBoundingClientRect().height,
          width: range.getBoundingClientRect().width,
          gap: after!.getBoundingClientRect().top
            - before!.getBoundingClientRect().bottom,
        };
      })
    );
    const sample = (name: string) => {
      const measurement = measurements.find(item => item.sample === name);
      expect(measurement).toBeDefined();
      return measurement!;
    };
    const reference = sample('reference');
    // Mobile WebKit reports subpixel CSS coordinates; keep a 0.001px tolerance.
    expect(reference.height).toBeCloseTo(24, 3);
    for (
      const [name, content] of [
        ['space', ' '],
        ['spaces', '  '],
        ['nbsp', '\u00a0'],
      ]
    ) {
      const measured = sample(name!);
      expect(measured.text).toBe(content);
      expect(measured.height).toBeCloseTo(reference.height, 3);
      expect(measured.gap).toBeCloseTo(reference.gap, 3);
    }
    expect(sample('two-lines').height).toBeCloseTo(48, 3);
    expect(sample('space').width).toBeGreaterThan(0);
    expect(sample('spaces').width).toBeCloseTo(sample('space').width * 2, 1);
  });
}

test('raw-text updates preserve whitespace content and line measurement', async ({ page }) => {
  await goto(page);
  const text = page.locator(
    '.probe[data-backend="raw-text"][data-sample="space"] > x-text',
  ).nth(1);
  for (const content of ['M', '  ', ' \n ', ' ']) {
    await text.locator('raw-text').evaluate((raw, value) => {
      raw.setAttribute('text', value);
    }, content);
    await expect.poll(() => text.evaluate(element => element.textContent))
      .toBe(content);
    await expect.poll(() =>
      text.evaluate(element => element.getBoundingClientRect().height)
    )
      .toBeCloseTo(content.includes('\n') ? 48 : 24, 3);
  }
});
