import { test, expect } from '@lynx-js/playwright-fixtures';

test.describe('SSR No JS', () => {
  test.use({ javaScriptEnabled: false });

  for (const setting of ['true', 'false', 'default']) {
    test(`config-css-inheritance-${setting}`, async ({ page }) => {
      await page.goto(`/ssr?casename=config-css-inheritance-${setting}`, {
        waitUntil: 'load',
      });
      const enabled = setting === 'true';
      const pageElement = page.locator('[part="page"]');
      if (enabled) {
        await expect(pageElement).toHaveAttribute(
          'lynx-enable-css-inheritance',
          'true',
        );
      } else {
        await expect(pageElement).not.toHaveAttribute(
          'lynx-enable-css-inheritance',
        );
      }
      await expect(page.locator('#solid-text')).toHaveCSS(
        'color',
        enabled ? 'rgb(255, 0, 0)' : 'rgb(0, 0, 0)',
      );
      await expect(page.locator('#gradient-text')).toHaveCSS(
        'background-image',
        enabled ? 'linear-gradient(rgb(255, 0, 0), rgb(0, 0, 255))' : 'none',
      );
      if (enabled) {
        await expect(page.locator('#gradient-text')).toHaveCSS(
          'background-clip',
          'text',
        );
        await expect(page.locator('#wrapped-gradient')).toHaveCSS(
          'background-clip',
          'text',
        );
      }
      await expect(page.locator('#override-text')).toHaveCSS(
        'color',
        'rgb(0, 128, 0)',
      );
    });
  }

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
