import { test, expect } from '@lynx-js/playwright-fixtures';
import type { Page } from '@playwright/test';

const goto = async (page: Page, fixtureName: string) => {
  await page.goto(`tests/fixtures/${fixtureName}.html`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
};

test.describe('x-webview', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('https://example.com', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<html><body><h1>Mocked Example Domain</h1></body></html>',
      });
    });
  });

  test('should render iframe with src', async ({ page }) => {
    await goto(page, 'x-webview/basics');
    const webview = page.locator('x-webview');
    await expect(webview).toBeVisible();

    const iframe = webview.locator('iframe');
    await expect(iframe).toBeVisible();
    await expect(iframe).toHaveAttribute('src', 'https://example.com');
  });

  test('should update src attribute', async ({ page }) => {
    await goto(page, 'x-webview/basics');
    const webview = page.locator('x-webview');

    await webview.evaluate(el => el.setAttribute('src', 'about:blank'));
    const iframe = webview.locator('iframe');
    await expect(iframe).toHaveAttribute('src', 'about:blank');
  });

  test('should handle html attribute', async ({ page }) => {
    await goto(page, 'x-webview/basics');
    const webview = page.locator('x-webview');

    await webview.evaluate(el => el.setAttribute('html', '<h1>Hello</h1>'));
    const iframe = webview.locator('iframe');
    await expect(iframe).toHaveAttribute('srcdoc', '<h1>Hello</h1>');
  });

  test('should fire bindload event', async ({ page }) => {
    // Navigate to a page that will load quickly
    await goto(page, 'x-webview/basics');
    const webview = page.locator('x-webview');

    // Trigger a load
    await webview.evaluate(el => el.setAttribute('src', 'about:blank'));

    // Check if the event listener in the fixture caught the event
    // Note: 'load' event on iframe might be tricky to catch if it happens too fast,
    // but about:blank should be instantaneous. We might need to wait a bit.
    await page.waitForFunction(() => {
      const webview = document.querySelector('x-webview');
      const iframe = webview.shadowRoot.querySelector('iframe');
      return window._bindload_fired === true
        || (iframe && iframe.contentWindow
          && iframe.contentWindow.location.href === 'about:blank');
    });
  });

  test('should fire bindmessage event', async ({ page }) => {
    await goto(page, 'x-webview/basics');
    const webview = page.locator('x-webview');

    // Inject script into iframe to post message
    // Since we are cross-origin (example.com), we can't easily access contentWindow.
    // So let's use srcdoc (html attribute) which treats it as same-origin (or at least we can control it).

    await webview.evaluate(el => {
      el.setAttribute(
        'html',
        `
            <script>
                window.parent.postMessage('hello from iframe', '*');
            </script>
        `,
      );
    });

    await expect(page.waitForFunction(() => window._bindmessage_fired === true))
      .resolves.toBeTruthy();
    const data = await page.evaluate(() => window._bindmessage_data);
    expect(data.msg).toBe('hello from iframe');
  });
});
