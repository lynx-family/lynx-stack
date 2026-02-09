import { test, expect } from '@lynx-js/playwright-fixtures';
import type { Page } from '@playwright/test';

const goto = async (page: Page, fixtureName: string) => {
  await page.goto(`tests/fixtures/${fixtureName}.html`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
};

const getShadowText = async (page: Page, selector: string) =>
  page.evaluate((value) => {
    const element = document.querySelector('x-markdown');
    return element?.shadowRoot?.querySelector(value)?.textContent ?? '';
  }, selector);

const getShadowCount = async (page: Page, selector: string) =>
  page.evaluate((value) => {
    const element = document.querySelector('x-markdown');
    return element?.shadowRoot?.querySelectorAll(value).length ?? 0;
  }, selector);

const appendContent = async (page: Page, suffix: string) => {
  await page.evaluate((value) => {
    const element = document.querySelector('x-markdown');
    const content = element?.getAttribute('content') ?? '';
    element?.setAttribute('content', `${content}${value}`);
  }, suffix);
};

const captureFirstChild = async (page: Page) => {
  await page.evaluate(() => {
    const element = document.querySelector('x-markdown');
    const root = element?.shadowRoot?.querySelector('#markdown-root');
    (window as any).__markdown_first_child = root?.firstElementChild ?? null;
  });
};

const isFirstChildSame = async (page: Page) =>
  page.evaluate(() => {
    const element = document.querySelector('x-markdown');
    const root = element?.shadowRoot?.querySelector('#markdown-root');
    return root?.firstElementChild === (window as any).__markdown_first_child;
  });

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

  test('should append content incrementally', async ({ page }) => {
    await goto(page, 'x-markdown/basic');
    expect(await getShadowText(page, 'h1')).toBe('Title');
    await captureFirstChild(page);
    await appendContent(page, '\n\n## More');
    await page.waitForFunction(() => {
      const element = document.querySelector('x-markdown');
      const root = element?.shadowRoot;
      return root?.querySelector('h2')?.textContent === 'More';
    });
    expect(await isFirstChildSame(page)).toBe(true);
  });

  test('should re-render when content diverges', async ({ page }) => {
    await goto(page, 'x-markdown/basic');
    await captureFirstChild(page);
    await page.evaluate(() => {
      const element = document.querySelector('x-markdown');
      element?.setAttribute('content', '# Title\n\nReplaced');
    });
    await page.waitForFunction(() => {
      const element = document.querySelector('x-markdown');
      return element?.shadowRoot?.querySelector('p')?.textContent
        === 'Replaced';
    });
    expect(await isFirstChildSame(page)).toBe(false);
  });

  test('should batch append by newline boundary', async ({ page }) => {
    await goto(page, 'x-markdown/incremental');
    expect(await getShadowCount(page, 'p')).toBe(1);
    await appendContent(page, 'Line 2');
    await page.waitForTimeout(20);
    expect(await getShadowCount(page, 'p')).toBe(1);
    await page.waitForTimeout(80);
    expect(await getShadowCount(page, 'p')).toBe(2);
  });
});
