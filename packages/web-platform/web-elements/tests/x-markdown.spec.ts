import { test, expect } from '@lynx-js/playwright-fixtures';
import type { Page } from '@playwright/test';

const goto = async (page: Page, fixtureName: string) => {
  await page.goto(`tests/fixtures/${fixtureName}.html`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
};

test.describe('x-markdown', () => {
  test('should render basic markdown', async ({ page }) => {
    await goto(page, 'x-markdown/basic');
    const markdown = page.locator('x-markdown');

    await expect(markdown.locator('h1')).toHaveText('Title');
    await expect(markdown.locator('strong')).toHaveText('bold');
    await expect(markdown.locator('em')).toHaveText('italic');
    await expect(markdown.locator('li')).toHaveCount(2);
    await expect(markdown.locator('code').first()).toContainText('code');
  });

  test('should apply markdown-style updates', async ({ page }) => {
    await goto(page, 'x-markdown/style');
    const markdown = page.locator('x-markdown');

    const link = markdown.locator('a');
    await expect(link).toHaveCSS('color', 'rgb(255, 0, 0)');

    const inlineCode = markdown.locator('code').first();
    await expect(inlineCode).toHaveCSS('color', 'rgb(0, 0, 255)');
    await expect(inlineCode).toHaveCSS(
      'background-color',
      'rgb(238, 238, 238)',
    );

    await markdown.evaluate((el) => {
      el.setAttribute(
        'markdown-style',
        JSON.stringify({ link: { color: '0000ff' } }),
      );
    });
    await expect(link).toHaveCSS('color', 'rgb(0, 0, 255)');
  });

  test('should render image', async ({ page }) => {
    await goto(page, 'x-markdown/image');
    const markdown = page.locator('x-markdown');

    const image = markdown.locator('img');
    await expect(image).toHaveAttribute(
      'src',
      '/tests/fixtures/resources/firefox-logo.png',
    );
  });

  test('should update content on attribute change', async ({ page }) => {
    await goto(page, 'x-markdown/basic');
    const markdown = page.locator('x-markdown');

    await markdown.evaluate((el) => {
      el.setAttribute('content', '# Updated');
    });
    await expect(markdown.locator('h1')).toHaveText('Updated');
  });

  test('should fire bindlink and bindimageTap events', async ({ page }) => {
    await goto(page, 'x-markdown/events');
    const markdown = page.locator('x-markdown');

    await markdown.locator('a').click();
    await page.waitForFunction(() => (window as any)._bindlink_detail !== null);
    const linkDetail = await page.evaluate(() =>
      (window as any)._bindlink_detail
    );
    expect(linkDetail.url).toBe('https://example.com');
    expect(linkDetail.content).toBe('link');
    expect(linkDetail.contentId).toBe('case-1');

    await markdown.locator('img').click();
    await page.waitForFunction(() =>
      (window as any)._bindimage_detail !== null
    );
    const imageDetail = await page.evaluate(() =>
      (window as any)._bindimage_detail
    );
    expect(imageDetail.url).toContain(
      '/tests/fixtures/resources/firefox-logo.png',
    );
    expect(imageDetail.contentId).toBe('case-1');
  });
});
