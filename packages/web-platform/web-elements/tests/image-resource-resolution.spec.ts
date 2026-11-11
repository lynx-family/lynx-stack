// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { test, expect } from '@lynx-js/playwright-fixtures';
import type { Page } from '@playwright/test';

const goto = async (page: Page) => {
  await page.goto('tests/fixtures/x-image/resource-resolution.html');
  await page.evaluate(() => document.fonts.ready);
};

const mount = async (page: Page, tag: string, src = 'image.svg') => {
  await page.evaluate(({ tag, src }) => {
    const image = document.createElement(tag);
    image.id = 'image';
    // Attribute callbacks run before the image has a shadow-root host.
    image.setAttribute('src', src);
    image.setAttribute('placeholder', 'placeholder.svg');
    for (const name of ['first', 'second']) {
      const host = document.createElement('div') as HTMLDivElement & {
        resolveResource: (src: string) => string;
      };
      host.id = name;
      host.dataset.base = `/assets/${name}/`;
      host.resolveResource = function(src) {
        return new URL(src, new URL(this.dataset.base!, document.baseURI)).href;
      };
      const root = host.attachShadow({ mode: 'open' });
      document.body.append(host);
      if (name === 'first') root.append(image);
    }
  }, { tag, src });
};

for (const tag of ['x-image', 'filter-image']) {
  test.describe(`${tag} resource resolution`, () => {
    const requests: string[] = [];
    test.beforeEach(async ({ page }) => {
      requests.length = 0;
      await page.route('**/*.svg', async route => {
        requests.push(new URL(route.request().url()).pathname);
        if (route.request().url().includes('broken.svg')) {
          await route.fulfill({ status: 404, body: '' });
        } else {
          await route.fulfill({
            contentType: 'image/svg+xml',
            body:
              '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="6"/>',
          });
        }
      });
      await goto(page);
    });

    test('resolves detached attributes on connection and subsequent updates', async ({ page }) => {
      await mount(page, tag);
      const image = page.locator('#image');
      const inner = image.locator('#img');
      await expect(inner).toHaveAttribute('src', /\/assets\/first\/image.svg$/);
      await expect(image).toHaveAttribute('src', 'image.svg');
      await expect(image).toHaveAttribute('placeholder', 'placeholder.svg');
      await expect.poll(() => requests).toContain(
        '/assets/first/placeholder.svg',
      );
      await image.evaluate(el => el.setAttribute('src', 'updated.svg'));
      await expect(inner).toHaveAttribute(
        'src',
        /\/assets\/first\/updated.svg$/,
      );
      await expect.poll(() => requests).toContain('/assets/first/updated.svg');
      await image.evaluate(el =>
        el.setAttribute('placeholder', 'updated-placeholder.svg')
      );
      await expect.poll(() => requests).toContain(
        '/assets/first/updated-placeholder.svg',
      );
    });

    test('resolves placeholders for empty or removed sources', async ({ page }) => {
      await mount(page, tag, '');
      const image = page.locator('#image');
      const inner = image.locator('#img');
      await expect(inner).toHaveAttribute(
        'src',
        /\/assets\/first\/placeholder.svg$/,
      );
      await image.evaluate(el => el.setAttribute('src', 'image.svg'));
      await expect(inner).toHaveAttribute('src', /\/assets\/first\/image.svg$/);
      await image.evaluate(el => el.removeAttribute('src'));
      await expect(inner).toHaveAttribute(
        'src',
        /\/assets\/first\/placeholder.svg$/,
      );
      await image.evaluate(el => {
        el.removeAttribute('placeholder');
        el.setAttribute('src', 'image.svg');
      });
      await expect(inner).toHaveAttribute('src', /\/assets\/first\/image.svg$/);
      await image.evaluate(el => el.setAttribute('src', 'false'));
      await expect(image).not.toHaveAttribute('src');
      await expect(inner).not.toHaveAttribute('src');
    });

    test('uses the resolved placeholder after a load error', async ({ page }) => {
      await mount(page, tag, 'broken.svg');
      const image = page.locator('#image');
      await expect(image.locator('#img')).toHaveAttribute(
        'src',
        /\/assets\/first\/placeholder.svg$/,
      );
      await expect.poll(() => requests).toContain('/assets/first/broken.svg');
      await expect(image).toHaveAttribute('src', 'broken.svg');
      await expect.poll(() =>
        image.locator('#img').evaluate(
          el => (el as HTMLImageElement).naturalWidth,
        )
      ).toBe(8);
    });

    test('resolves again when moved between shadow-root hosts', async ({ page }) => {
      await mount(page, tag);
      const image = page.locator('#image');
      await expect(image.locator('#img')).toHaveAttribute(
        'src',
        /\/assets\/first\/image.svg$/,
      );
      await image.evaluate(el =>
        document.querySelector('#second')!.shadowRoot!.append(el)
      );
      await expect(image.locator('#img')).toHaveAttribute(
        'src',
        /\/assets\/second\/image.svg$/,
      );
      await expect.poll(() => requests).toContain(
        '/assets/second/placeholder.svg',
      );
      await expect(image).toHaveAttribute('src', 'image.svg');
      await image.evaluate(el => document.body.append(el));
      await expect(image.locator('#img')).toHaveAttribute('src', 'image.svg');
    });

    test('keeps URLs unchanged without a resolver in light or shadow DOM', async ({ page }) => {
      await page.evaluate(tag => {
        const host = document.createElement('div');
        const root = host.attachShadow({ mode: 'open' });
        document.body.append(host);
        for (const parent of [document.body, root]) {
          const image = document.createElement(tag);
          image.setAttribute('src', 'image.svg');
          parent.append(image);
        }
      }, tag);
      const images = page.locator(tag);
      await expect(images).toHaveCount(2);
      for (let i = 0; i < 2; i++) {
        await expect(images.nth(i).locator('#img')).toHaveAttribute(
          'src',
          'image.svg',
        );
      }
    });

    test('does not reassign a relative placeholder on repeated errors', async ({ page }) => {
      await mount(page, tag);
      await page.locator('#first').evaluate(el => {
        (el as HTMLElement & { resolveResource: (src: string) => string })
          .resolveResource = src => `/relative/${src}`;
      });
      const image = page.locator('#image');
      await image.evaluate(el => el.setAttribute('src', 'broken.svg'));
      const inner = image.locator('#img');
      await expect(inner).toHaveAttribute('src', '/relative/placeholder.svg');
      const mutations = await inner.evaluate(el => {
        const observer = new MutationObserver(() => {});
        observer.observe(el, { attributes: true, attributeFilter: ['src'] });
        el.dispatchEvent(new Event('error'));
        el.dispatchEvent(new Event('error'));
        const count = observer.takeRecords().length;
        observer.disconnect();
        return count;
      });
      expect(mutations).toBe(0);
    });
  });
}
