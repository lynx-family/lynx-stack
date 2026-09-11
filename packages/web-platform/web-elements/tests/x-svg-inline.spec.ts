// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { expect, test } from '@lynx-js/playwright-fixtures';
import type { Page } from '@playwright/test';

const goto = async (page: Page, fixtureName: string) => {
  await page.goto(`/tests/fixtures/x-text/${fixtureName}.html`, {
    waitUntil: 'load',
  });
  await page.evaluate(() => document.fonts.ready);
};

for (const parent of ['x-text', 'inline-truncation']) {
  for (const wrapped of [false, true]) {
    test(`x-svg inline layout in ${parent}, wrapped=${wrapped}`, async ({ page }) => {
      await goto(page, 'inline-image');
      await page.evaluate(({ parent, wrapped }) => {
        document.body.replaceChildren();
        const src = 'data:image/svg+xml,'
          + encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="green"/></svg>',
          );
        for (const tag of ['x-image', 'x-svg']) {
          const text = document.createElement('x-text');
          text.id = `${tag}-text`;
          text.style.cssText =
            'width: 240px; font-size: 20px; line-height: 40px';
          text.setAttribute('text-selection', 'true');
          let container: HTMLElement = text;
          if (parent === 'inline-truncation') {
            text.setAttribute('x-show-inline-truncation', '');
            container = document.createElement(parent);
            text.append(container);
          }
          container.append('Before');
          if (wrapped) {
            const wrapper = document.createElement('lynx-wrapper');
            container.append(wrapper);
            container = wrapper;
          }
          const image = document.createElement(tag);
          image.setAttribute('src', src);
          image.style.cssText =
            'width: 28px; height: 24px; margin: 2px 7px; vertical-align: middle; border: 2px solid blue; border-radius: 4px; background-color: red';
          container.append(image, 'After');
          document.body.append(text);
        }
      }, { parent, wrapped });
      if (parent === 'inline-truncation') {
        await page.locator('x-text').evaluateAll(elements => {
          for (const element of elements) {
            element.setAttribute('x-show-inline-truncation', '');
          }
        });
      }

      const geometry = () =>
        page.evaluate(() => {
          return ['x-image', 'x-svg'].map(tag => {
            const host = document.querySelector(tag)!;
            const img = host.shadowRoot!.querySelector('img')!;
            const rect = img.getBoundingClientRect();
            const textRect = document.querySelector(`#${tag}-text`)!
              .getBoundingClientRect();
            const style = getComputedStyle(img);
            return {
              x: rect.x - textRect.x,
              y: rect.y - textRect.y,
              width: rect.width,
              height: rect.height,
              textHeight: textRect.height,
              margin: style.margin,
              verticalAlign: style.verticalAlign,
              border: style.border,
              borderRadius: style.borderRadius,
              backgroundColor: style.backgroundColor,
            };
          });
        });

      await expect(page.locator('x-svg')).toHaveCSS('display', 'contents');
      await expect(page.locator('x-svg').locator('img')).toHaveCSS(
        'width',
        '28px',
      );
      const [image, svg] = await geometry();
      expect(svg).toEqual(image);

      await page.locator('x-image, x-svg').evaluateAll(elements => {
        for (const element of elements) {
          (element as HTMLElement).style.width = '42px';
          (element as HTMLElement).style.verticalAlign = 'bottom';
        }
      });
      await expect(page.locator('x-svg').locator('img')).toHaveCSS(
        'width',
        '42px',
      );
      const [updatedImage, updatedSvg] = await geometry();
      expect(updatedSvg).toEqual(updatedImage);
      if (parent === 'x-text') {
        expect(
          await page.locator('x-svg').evaluate(element => {
            const style = getComputedStyle(element);
            return style.getPropertyValue('user-select')
              || style.getPropertyValue('-webkit-user-select');
          }),
        ).toMatch(/^(auto|text)$/);
      }
    });
  }
}

test('x-svg counts as one character and is restored after truncation changes', async ({ page }) => {
  await goto(page, 'inline-image');
  await page.evaluate(() => {
    const text = document.querySelector('x-text')!;
    text.replaceChildren();
    const svg = document.createElement('x-svg');
    svg.style.cssText = 'width: 22px; height: 22px';
    svg.setAttribute(
      'content',
      '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22"><circle cx="11" cy="11" r="10" fill="green"/></svg>',
    );
    text.append('A', svg, 'BC');
    text.setAttribute('text-maxlength', '2');
  });
  const text = page.locator('x-text');
  const svg = page.locator('x-svg');
  await expect(text).toHaveText('A');
  await expect(svg.locator('img')).toBeVisible();

  await text.evaluate(element => element.setAttribute('text-maxlength', '1'));
  await expect(svg).toHaveAttribute('x-text-clipped', '');
  await expect(svg.locator('img')).toBeHidden();

  await text.evaluate(element => element.removeAttribute('text-maxlength'));
  await expect(svg).not.toHaveAttribute('x-text-clipped');
  await expect(svg.locator('img')).toBeVisible();
});

test('x-svg sizes custom line truncation like x-image', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await goto(page, 'inline-truncation-with-inline-image');
  const truncation = page.locator('inline-truncation');
  await expect(truncation).toBeVisible();
  const before = await truncation.boundingBox();
  await page.locator('x-image').evaluate(image => {
    const svg = document.createElement('x-svg');
    svg.setAttribute('style', image.getAttribute('style')!);
    svg.setAttribute(
      'content',
      '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><rect width="12" height="12" fill="green"/></svg>',
    );
    image.replaceWith(svg);
  });
  await expect(truncation.locator('x-svg').locator('img')).toBeVisible();
  await expect.poll(() => truncation.boundingBox()).toEqual(before);
  await expect(page.locator('x-text')).toHaveAttribute('x-text-clipped', '');
});
