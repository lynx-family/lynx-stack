import { test, expect } from '@lynx-js/playwright-fixtures';

test.describe('SSR No JS', () => {
  test.use({ javaScriptEnabled: false });

  test('basic-pink-rect', async ({ page }) => {
    // 1. Navigate to SSR page
    await page.goto('/ssr?casename=basic-pink-rect', {
      waitUntil: 'load',
    });

    // 2. Verify Attributes
    const lynxView = page.locator('lynx-view');
    await expect(lynxView).toHaveAttribute('id', 'lynxview1');
    await expect(lynxView).toHaveAttribute('height', 'auto');
    await expect(lynxView).toHaveAttribute(
      'url',
      '/dist/ssr/basic-pink-rect.web.bundle',
    );
  });
});
