// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
// @ts-nocheck
import { test, expect } from './coverage-fixture.js';

const wait = async (ms: number) => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

test.describe('web-style-transformer tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/main-thread-test.html`, {
      waitUntil: 'domcontentloaded',
    });
    await wait(200);

    // Setup rpx variable for testing
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.textContent = ':root { --rpx: 1px; }';
      document.head.appendChild(style);
    });
  });

  test.describe('rpx unit transformation', () => {
    test('basic rpx transformation', async ({ page }) => {
      await page.evaluate(() => {
        const root = globalThis.__CreatePage('page', 0);
        const view = globalThis.__CreateView(0);
        globalThis.__SetID(view, 'test-view');
        globalThis.__AddInlineStyle(view, 'width', '100rpx');
        globalThis.__AppendElement(root, view);
        globalThis.__FlushElementTree();
      });

      const viewElement = page.locator('#test-view');
      const style = await viewElement.getAttribute('style');
      expect(style).toContain('calc(100 * var(--rpx))');
      await expect(viewElement).toHaveCSS('width', '100px');
    });

    test('negative rpx values', async ({ page }) => {
      await page.evaluate(() => {
        const root = globalThis.__CreatePage('page', 0);
        const view = globalThis.__CreateView(0);
        globalThis.__SetID(view, 'test-view');
        globalThis.__AddInlineStyle(view, 'margin-left', '-10rpx');
        globalThis.__AppendElement(root, view);
        globalThis.__FlushElementTree();
      });

      const viewElement = page.locator('#test-view');
      const style = await viewElement.getAttribute('style');
      expect(style).toContain('calc(-10 * var(--rpx))');
      await expect(viewElement).toHaveCSS('margin-left', '-10px');
    });

    test('decimal rpx values', async ({ page }) => {
      await page.evaluate(() => {
        const root = globalThis.__CreatePage('page', 0);
        const view = globalThis.__CreateView(0);
        globalThis.__SetID(view, 'test-view');
        globalThis.__AddInlineStyle(view, 'width', '1.5rpx');
        globalThis.__AppendElement(root, view);
        globalThis.__FlushElementTree();
      });

      const viewElement = page.locator('#test-view');
      const style = await viewElement.getAttribute('style');
      expect(style).toContain('calc(1.5 * var(--rpx))');
      await expect(viewElement).toHaveCSS('width', '1.5px');
    });

    test('mixed units with rpx', async ({ page }) => {
      await page.evaluate(() => {
        const root = globalThis.__CreatePage('page', 0);
        const view = globalThis.__CreateView(0);
        globalThis.__SetID(view, 'test-view');
        globalThis.__SetInlineStyles(view, 'margin: 10px 5rpx 20px 15rpx');
        globalThis.__AppendElement(root, view);
        globalThis.__FlushElementTree();
      });

      const viewElement = page.locator('#test-view');
      const style = await viewElement.getAttribute('style');
      expect(style).toContain(
        '10px calc(5 * var(--rpx)) 20px calc(15 * var(--rpx))',
      );
      await expect(viewElement).toHaveCSS('margin-right', '5px');
      await expect(viewElement).toHaveCSS('margin-left', '15px');
    });

    test('rpx in multiple CSS properties', async ({ page }) => {
      await page.evaluate(() => {
        const root = globalThis.__CreatePage('page', 0);
        const view = globalThis.__CreateView(0);
        globalThis.__SetID(view, 'test-view');
        globalThis.__SetInlineStyles(view, {
          'width': '100rpx',
          'height': '50rpx',
          'padding': '5rpx',
          'margin': '10rpx 20rpx',
        });
        globalThis.__AppendElement(root, view);
        globalThis.__FlushElementTree();
      });

      const viewElement = page.locator('#test-view');
      const style = await viewElement.getAttribute('style');
      expect(style).toContain('calc(100 * var(--rpx))');
      expect(style).toContain('calc(50 * var(--rpx))');
      expect(style).toContain('calc(5 * var(--rpx))');
      expect(style).toContain('calc(10 * var(--rpx)) calc(20 * var(--rpx))');

      await expect(viewElement).toHaveCSS('width', '100px');
      await expect(viewElement).toHaveCSS('height', '50px');
      await expect(viewElement).toHaveCSS('padding', '5px');
    });

    test('rpx with !important', async ({ page }) => {
      await page.evaluate(() => {
        const root = globalThis.__CreatePage('page', 0);
        const view = globalThis.__CreateView(0);
        globalThis.__SetID(view, 'test-view');
        globalThis.__SetInlineStyles(view, 'width: 100rpx !important');
        globalThis.__AppendElement(root, view);
        globalThis.__FlushElementTree();
      });

      const viewElement = page.locator('#test-view');
      const style = await viewElement.getAttribute('style');
      expect(style).toContain('calc(100 * var(--rpx)) !important');
      await expect(viewElement).toHaveCSS('width', '100px');
    });

    test('zero rpx values', async ({ page }) => {
      await page.evaluate(() => {
        const root = globalThis.__CreatePage('page', 0);
        const view = globalThis.__CreateView(0);
        globalThis.__SetID(view, 'test-view');
        globalThis.__AddInlineStyle(view, 'margin', '0rpx');
        globalThis.__AppendElement(root, view);
        globalThis.__FlushElementTree();
      });

      const viewElement = page.locator('#test-view');
      const style = await viewElement.getAttribute('style');
      expect(style).toContain('calc(0 * var(--rpx))');
      await expect(viewElement).toHaveCSS('margin', '0px');
    });
  });

  test.describe('rpx edge cases', () => {
    test('rpx in url should not be transformed', async ({ page }) => {
      await page.evaluate(() => {
        const root = globalThis.__CreatePage('page', 0);
        const view = globalThis.__CreateView(0);
        globalThis.__SetID(view, 'test-view');
        globalThis.__SetInlineStyles(
          view,
          'background-image: url(image-1rpx.png)',
        );
        globalThis.__AppendElement(root, view);
        globalThis.__FlushElementTree();
      });

      const viewElement = page.locator('#test-view');
      const style = await viewElement.getAttribute('style');
      expect(style).toContain('url(image-1rpx.png)');
      expect(style).not.toContain('calc');
    });

    test('rpx in string should not be transformed', async ({ page }) => {
      await page.evaluate(() => {
        const root = globalThis.__CreatePage('page', 0);
        const view = globalThis.__CreateView(0);
        globalThis.__SetID(view, 'test-view');
        globalThis.__SetInlineStyles(view, 'content: "text with 1rpx"');
        globalThis.__AppendElement(root, view);
        globalThis.__FlushElementTree();
      });

      const viewElement = page.locator('#test-view');
      const style = await viewElement.getAttribute('style');
      expect(style).toContain('"text with 1rpx"');
      expect(style).not.toContain('calc');
    });

    test('non-rpx units should remain unchanged', async ({ page }) => {
      await page.evaluate(() => {
        const root = globalThis.__CreatePage('page', 0);
        const view = globalThis.__CreateView(0);
        globalThis.__SetID(view, 'test-view');
        globalThis.__SetInlineStyles(view, {
          'width': '100px',
          'height': '50%',
          'margin': '10em',
          'padding': '5rem',
        });
        globalThis.__AppendElement(root, view);
        globalThis.__FlushElementTree();
      });

      const viewElement = page.locator('#test-view');
      const style = await viewElement.getAttribute('style');
      expect(style).toContain('100px');
      expect(style).toContain('50%');
      expect(style).toContain('10em');
      expect(style).toContain('5rem');
      expect(style).not.toContain('calc');
    });
  });

  test.describe('rpx with existing CSS transformations', () => {
    test('rpx with flex properties', async ({ page }) => {
      await page.evaluate(() => {
        const root = globalThis.__CreatePage('page', 0);
        const view = globalThis.__CreateView(0);
        globalThis.__SetID(view, 'test-view');
        globalThis.__SetInlineStyles(view, {
          'flex-basis': '100rpx',
          'flex-grow': '1',
          'flex-shrink': '0',
        });
        globalThis.__AppendElement(root, view);
        globalThis.__FlushElementTree();
      });

      const viewElement = page.locator('#test-view');
      const style = await viewElement.getAttribute('style');
      expect(style).toContain('--flex-basis');
      expect(style).toContain('calc(100 * var(--rpx))');
      expect(style).toContain('--flex-grow:1');
      expect(style).toContain('--flex-shrink:0');
    });

    test('rpx with color gradient', async ({ page }) => {
      await page.evaluate(() => {
        const root = globalThis.__CreatePage('page', 0);
        const view = globalThis.__CreateView(0);
        globalThis.__SetID(view, 'test-view');
        globalThis.__SetInlineStyles(
          view,
          'color: linear-gradient(to right, red 10rpx, blue)',
        );
        globalThis.__AppendElement(root, view);
        globalThis.__FlushElementTree();
      });

      const viewElement = page.locator('#test-view');
      const style = await viewElement.getAttribute('style');
      expect(style).toContain('color:transparent');
      expect(style).toContain('-webkit-background-clip:text');
      expect(style).toContain(
        '--lynx-text-bg-color:linear-gradient(to right, red calc(10 * var(--rpx)), blue)',
      );
    });

    test('rpx with linear-weight properties', async ({ page }) => {
      await page.evaluate(() => {
        const root = globalThis.__CreatePage('page', 0);
        const view = globalThis.__CreateView(0);
        globalThis.__SetID(view, 'test-view');
        globalThis.__SetInlineStyles(view, {
          'linear-weight': '2',
          'width': '100rpx',
        });
        globalThis.__AppendElement(root, view);
        globalThis.__FlushElementTree();
      });

      const viewElement = page.locator('#test-view');
      const style = await viewElement.getAttribute('style');
      expect(style).toContain('--lynx-linear-weight:2');
      expect(style).toContain('--lynx-linear-weight-basis:0');
      expect(style).toContain('calc(100 * var(--rpx))');
    });
  });

  test.describe('different rpx scale factors', () => {
    test('rpx with different scale factor', async ({ page }) => {
      // Change the rpx scale factor
      await page.evaluate(() => {
        const style = document.querySelector('style');
        style.textContent = ':root { --rpx: 2px; }';
      });

      await page.evaluate(() => {
        const root = globalThis.__CreatePage('page', 0);
        const view = globalThis.__CreateView(0);
        globalThis.__SetID(view, 'test-view');
        globalThis.__AddInlineStyle(view, 'width', '100rpx');
        globalThis.__AppendElement(root, view);
        globalThis.__FlushElementTree();
      });

      const viewElement = page.locator('#test-view');
      const style = await viewElement.getAttribute('style');
      expect(style).toContain('calc(100 * var(--rpx))');
      await expect(viewElement).toHaveCSS('width', '200px');
    });

    test('rpx with fractional scale factor', async ({ page }) => {
      // Change the rpx scale factor to 0.5px
      await page.evaluate(() => {
        const style = document.querySelector('style');
        style.textContent = ':root { --rpx: 0.5px; }';
      });

      await page.evaluate(() => {
        const root = globalThis.__CreatePage('page', 0);
        const view = globalThis.__CreateView(0);
        globalThis.__SetID(view, 'test-view');
        globalThis.__AddInlineStyle(view, 'width', '100rpx');
        globalThis.__AppendElement(root, view);
        globalThis.__FlushElementTree();
      });

      const viewElement = page.locator('#test-view');
      const style = await viewElement.getAttribute('style');
      expect(style).toContain('calc(100 * var(--rpx))');
      await expect(viewElement).toHaveCSS('width', '50px');
    });
  });

  test.describe('complex rpx scenarios', () => {
    test('complex layout with multiple rpx values', async ({ page }) => {
      await page.evaluate(() => {
        const root = globalThis.__CreatePage('page', 0);

        // Container
        const container = globalThis.__CreateView(0);
        globalThis.__SetID(container, 'container');
        globalThis.__SetInlineStyles(container, {
          'width': '750rpx',
          'height': '400rpx',
          'padding': '10rpx 20rpx',
          'margin': '15rpx auto',
          'display': 'flex',
        });

        // Child 1
        const child1 = globalThis.__CreateView(0);
        globalThis.__SetID(child1, 'child1');
        globalThis.__SetInlineStyles(child1, {
          'width': '200rpx',
          'height': '100rpx',
          'margin-right': '10rpx',
          'flex-basis': '200rpx',
        });

        // Child 2
        const child2 = globalThis.__CreateView(0);
        globalThis.__SetID(child2, 'child2');
        globalThis.__SetInlineStyles(child2, {
          'flex': '1',
          'min-width': '100rpx',
          'max-width': '500rpx',
          'padding': '5rpx',
        });

        globalThis.__AppendElement(root, container);
        globalThis.__AppendElement(container, child1);
        globalThis.__AppendElement(container, child2);
        globalThis.__FlushElementTree();
      });

      // Verify container
      const container = page.locator('#container');
      const containerStyle = await container.getAttribute('style');
      expect(containerStyle).toContain('calc(750 * var(--rpx))');
      expect(containerStyle).toContain('calc(400 * var(--rpx))');
      expect(containerStyle).toContain(
        'calc(10 * var(--rpx)) calc(20 * var(--rpx))',
      );
      expect(containerStyle).toContain('calc(15 * var(--rpx)) auto');

      // Verify child1
      const child1 = page.locator('#child1');
      const child1Style = await child1.getAttribute('style');
      expect(child1Style).toContain('calc(200 * var(--rpx))');
      expect(child1Style).toContain('calc(100 * var(--rpx))');
      expect(child1Style).toContain('calc(10 * var(--rpx))');
      expect(child1Style).toContain('--flex-basis');

      // Verify child2
      const child2 = page.locator('#child2');
      const child2Style = await child2.getAttribute('style');
      expect(child2Style).toContain('--flex-grow:1');
      expect(child2Style).toContain('calc(100 * var(--rpx))');
      expect(child2Style).toContain('calc(500 * var(--rpx))');
      expect(child2Style).toContain('calc(5 * var(--rpx))');

      // Verify computed CSS values
      await expect(container).toHaveCSS('width', '750px');
      await expect(container).toHaveCSS('height', '400px');
      await expect(child1).toHaveCSS('width', '200px');
      await expect(child1).toHaveCSS('height', '100px');
    });

    test('rpx with responsive behavior', async ({ page }) => {
      // Test different viewport sizes
      await page.setViewportSize({ width: 375, height: 667 });

      // Set rpx to be responsive (e.g., 1rpx = 0.5px on smaller screens)
      await page.evaluate(() => {
        const style = document.querySelector('style');
        style.textContent = ':root { --rpx: 0.5px; }';
      });

      await page.evaluate(() => {
        const root = globalThis.__CreatePage('page', 0);
        const view = globalThis.__CreateView(0);
        globalThis.__SetID(view, 'responsive-view');
        globalThis.__SetInlineStyles(view, {
          'width': '750rpx', // Should be 375px (half of 750)
          'height': '200rpx', // Should be 100px
          'font-size': '32rpx', // Should be 16px
        });
        globalThis.__AppendElement(root, view);
        globalThis.__FlushElementTree();
      });

      const view = page.locator('#responsive-view');
      const style = await view.getAttribute('style');
      expect(style).toContain('calc(750 * var(--rpx))');
      expect(style).toContain('calc(200 * var(--rpx))');
      expect(style).toContain('calc(32 * var(--rpx))');

      await expect(view).toHaveCSS('width', '375px');
      await expect(view).toHaveCSS('height', '100px');
      await expect(view).toHaveCSS('font-size', '16px');
    });
  });
});
