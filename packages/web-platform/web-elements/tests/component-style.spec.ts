import { test, expect } from '@lynx-js/playwright-fixtures';

const gotoComponentStylePage = async (page: any) => {
  await page.goto('/tests/fixtures/component-style-test.html', {
    waitUntil: 'load',
  });
  await page.evaluate(() => document.fonts.ready);
};

test.describe('Component style reactivity', () => {
  test('refreshes connected elements when stylesheets become available', async ({ page }) => {
    await gotoComponentStylePage(page);

    const target = page.locator('#style-host').locator('#style-target');
    await expect(target).toHaveAttribute('data-style-value', '');
    expect(
      await page.evaluate(() => (window as any).__styleValues),
    ).toEqual(['']);

    await page.evaluate(() => {
      const root = (window as any).__styleRoot as ShadowRoot;
      const style = document.createElement('style');
      style.textContent = 'x-style-test { --lynx-test-style: horizontal; }';
      root.prepend(style);
      (window as any).__styleSheet = style;
      (window as any).__refreshStyleReactiveElements(root);
    });
    await expect(target).toHaveAttribute('data-style-value', 'horizontal');

    await page.evaluate(async () => {
      (window as any).__refreshStyleReactiveElements(
        (window as any).__styleRoot,
      );
      await new Promise<void>((resolve) => queueMicrotask(resolve));
    });
    expect(
      await page.evaluate(() => (window as any).__styleValues),
    ).toEqual(['', 'horizontal']);

    await page.evaluate(() => {
      const root = (window as any).__styleRoot as ShadowRoot;
      const element = root.querySelector('x-style-test')!;
      element.remove();
      root.append(element);
    });
    await expect(target).toHaveAttribute('data-style-value', 'horizontal');
    expect(
      await page.evaluate(() => (window as any).__styleValues),
    ).toEqual(['', 'horizontal', 'horizontal']);

    await page.evaluate(() => {
      const style = (window as any).__styleSheet as HTMLStyleElement;
      style.textContent = 'x-style-test { --lynx-test-style: vertical; }';
      (window as any).__refreshStyleReactiveElements(
        (window as any).__styleRoot,
      );
    });
    await expect(target).toHaveAttribute('data-style-value', 'vertical');

    await page.evaluate(async () => {
      const root = (window as any).__styleRoot as ShadowRoot;
      root.querySelector('x-style-test')?.remove();
      (window as any).__styleSheet.textContent =
        'x-style-test { --lynx-test-style: diagonal; }';
      (window as any).__refreshStyleReactiveElements(root);
      await new Promise<void>((resolve) => queueMicrotask(resolve));
    });
    expect(
      await page.evaluate(() => (window as any).__styleValues),
    ).toEqual(['', 'horizontal', 'horizontal', 'vertical']);
  });
});
