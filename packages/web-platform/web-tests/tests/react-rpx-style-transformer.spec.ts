// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { test, expect } from './coverage-fixture.js';
import type { Page } from '@playwright/test';

const wait = async (ms: number) => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const goto = async (page: Page, testname: string) => {
  const isSSR = !!process.env['ENABLE_SSR'];
  let url = isSSR
    ? `/ssr?casename=${testname}&rpx-length=1px`
    : `/?casename=${testname}&rpx-length=1px`;
  await page.goto(url, {
    waitUntil: 'load',
  });
  await page.evaluate(() => document.fonts.ready);
  if (isSSR) await wait(300);
  await wait(200); // Additional wait for rpx elements to render
};

const waitForElement = async (
  page: Page,
  selector: string,
  timeout = 10000,
) => {
  await page.waitForSelector(selector, {
    state: 'visible',
    timeout,
  });
  return page.locator(selector);
};

test.describe('React RPX Style Transformer Tests', () => {
  test.describe('Inline Style RPX Transformation', () => {
    test('should transform basic rpx units in inline styles', async ({ page }) => {
      await goto(page, 'inline-style-rpx');

      // Test basic rpx transformation
      const basicElement = await waitForElement(page, '#basic-rpx');

      // Get the computed width and verify it's a reasonable rpx conversion
      const width = await basicElement.evaluate(el =>
        getComputedStyle(el).width
      );
      const height = await basicElement.evaluate(el =>
        getComputedStyle(el).height
      );
      const margin = await basicElement.evaluate(el =>
        getComputedStyle(el).marginTop
      );

      // Verify that rpx values are converted to reasonable pixel values
      // The exact values depend on viewport width and rpx calculation
      expect(parseFloat(width)).toBeGreaterThan(0);
      expect(parseFloat(height)).toBeGreaterThan(0);
      expect(parseFloat(margin)).toBeGreaterThan(0);

      // Test the ratio between different rpx values (100rpx should be 2x 50rpx)
      const widthValue = parseFloat(width);
      const heightValue = parseFloat(height);
      const ratio = widthValue / heightValue;
      expect(ratio).toBeCloseTo(2, 1); // 100rpx / 50rpx = 2
    });

    test('should handle mixed units with rpx in inline styles', async ({ page }) => {
      await goto(page, 'inline-style-rpx');

      const mixedElement = await waitForElement(page, '#mixed-units');

      // Get computed styles
      const width = await mixedElement.evaluate(el =>
        getComputedStyle(el).width
      );
      const paddingTop = await mixedElement.evaluate(el =>
        getComputedStyle(el).paddingTop
      );
      const paddingRight = await mixedElement.evaluate(el =>
        getComputedStyle(el).paddingRight
      );
      const paddingBottom = await mixedElement.evaluate(el =>
        getComputedStyle(el).paddingBottom
      );
      const paddingLeft = await mixedElement.evaluate(el =>
        getComputedStyle(el).paddingLeft
      );

      // Verify width is converted from rpx
      expect(parseFloat(width)).toBeGreaterThan(0);

      // Check that fixed px values remain unchanged
      expect(paddingTop).toBe('10px');
      expect(paddingBottom).toBe('15px');

      // Check that rpx values are converted to reasonable pixel values
      expect(parseFloat(paddingRight)).toBeGreaterThan(0); // 5rpx
      expect(parseFloat(paddingLeft)).toBeGreaterThan(0); // 20rpx

      // Test ratio: 20rpx should be 4x 5rpx
      const rightPadding = parseFloat(paddingRight);
      const leftPadding = parseFloat(paddingLeft);
      const paddingRatio = leftPadding / rightPadding;
      expect(paddingRatio).toBeCloseTo(4, 1); // 20rpx / 5rpx = 4
    });

    test('should handle negative rpx values in inline styles', async ({ page }) => {
      await goto(page, 'inline-style-rpx');

      const negativeElement = await page.locator('#negative-rpx');
      const marginTop = await negativeElement.evaluate(el =>
        getComputedStyle(el).marginTop
      );
      expect(marginTop).toBe('-10px'); // -10rpx -> -10px
    });

    test('should handle decimal rpx values in inline styles', async ({ page }) => {
      await goto(page, 'inline-style-rpx');

      const decimalElement = await page.locator('#decimal-rpx');
      await expect(decimalElement).toHaveCSS('width', '100.5px');
      await expect(decimalElement).toHaveCSS('height', '50.25px');
    });

    test('should handle rpx with !important in inline styles', async ({ page }) => {
      await goto(page, 'inline-style-rpx');

      const importantElement = await page.locator('#important-rpx');
      await expect(importantElement).toHaveCSS('width', '150px');
      await expect(importantElement).toHaveCSS('height', '75px');
    });

    test('should handle complex rpx values in inline styles', async ({ page }) => {
      await goto(page, 'inline-style-rpx');

      const complexElement = await page.locator('#complex-rpx');
      // Check margin: 5rpx 10rpx 15rpx 20rpx
      const marginTop = await complexElement.evaluate(el =>
        getComputedStyle(el).marginTop
      );
      const marginRight = await complexElement.evaluate(el =>
        getComputedStyle(el).marginRight
      );
      const marginBottom = await complexElement.evaluate(el =>
        getComputedStyle(el).marginBottom
      );
      const marginLeft = await complexElement.evaluate(el =>
        getComputedStyle(el).marginLeft
      );

      expect(marginTop).toBe('5px');
      expect(marginRight).toBe('10px');
      expect(marginBottom).toBe('15px');
      expect(marginLeft).toBe('20px');
    });

    test('should handle zero rpx values in inline styles', async ({ page }) => {
      await goto(page, 'inline-style-rpx');

      const zeroElement = await page.locator('#zero-rpx');
      await expect(zeroElement).toHaveCSS('margin', '0px');
      await expect(zeroElement).toHaveCSS('padding', '0px');
    });
  });

  test.describe('CSS Style RPX Transformation', () => {
    test('should transform basic rpx units in CSS classes', async ({ page }) => {
      await goto(page, 'css-style-rpx');

      const basicElement = await page.locator('#basic-css-rpx');
      await expect(basicElement).toHaveCSS('width', '120px');
      await expect(basicElement).toHaveCSS('height', '60px');
      await expect(basicElement).toHaveCSS('margin', '15px');
      await expect(basicElement).toHaveCSS('padding', '8px');
    });

    test('should handle mixed units with rpx in CSS', async ({ page }) => {
      await goto(page, 'css-style-rpx');

      const mixedElement = await page.locator('#mixed-css-units');
      await expect(mixedElement).toHaveCSS('width', '180px');
      await expect(mixedElement).toHaveCSS('height', '90px');

      // Check mixed margin: 10px 5rpx -> 10px 5px
      const marginTop = await mixedElement.evaluate(el =>
        getComputedStyle(el).marginTop
      );
      const marginRight = await mixedElement.evaluate(el =>
        getComputedStyle(el).marginRight
      );

      expect(marginTop).toBe('10px');
      expect(marginRight).toBe('5px'); // 5rpx -> 5px
    });

    test('should handle responsive rpx values in CSS', async ({ page }) => {
      await goto(page, 'css-style-rpx');

      const responsiveElement = await page.locator('#responsive-css-rpx');
      await expect(responsiveElement).toHaveCSS('width', '100px');
      await expect(responsiveElement).toHaveCSS('min-width', '80px');
      await expect(responsiveElement).toHaveCSS('max-width', '200px');
      await expect(responsiveElement).toHaveCSS('height', '50px');
      await expect(responsiveElement).toHaveCSS('min-height', '30px');
      await expect(responsiveElement).toHaveCSS('max-height', '100px');
    });

    test('should handle CSS variables with rpx', async ({ page }) => {
      await goto(page, 'css-style-rpx');

      const varElement = await page.locator('#var-css-rpx');
      await expect(varElement).toHaveCSS('width', '140px');
      await expect(varElement).toHaveCSS('height', '70px');
      await expect(varElement).toHaveCSS('margin', '12px');
    });

    test('should handle complex selectors with rpx', async ({ page, browserName }) => {
      await goto(page, 'css-style-rpx');

      const childElement = await page.locator('#child-css-rpx');
      await expect(childElement).toHaveCSS('width', '80px');
      await expect(childElement).toHaveCSS('height', '40px');
      // viewport width 390px & parent padding:20px -> margin: 10px calc((390px - 80px - 20px * 2) / 2);
      const viewportWidth = await page.evaluate(() => {
        return window.screen.availWidth;
      });

      if (browserName === 'firefox') {
        // firefox can get un-calculated margin
        await expect(childElement).toHaveCSS('margin', `10px auto`);
      } else {
        // webkit / chrome margin-value is calculated
        await expect(childElement).toHaveCSS(
          'margin',
          `10px ${(viewportWidth - 80 - 20 * 2) / 2}px`,
        );
      }
    });
  });

  test.describe('Edge Cases and Complex Scenarios', () => {
    test('should not transform rpx in URL strings', async ({ page }) => {
      await goto(page, 'edge-cases-rpx');

      const urlElement = await page.locator('#url-rpx');
      await expect(urlElement).toHaveCSS('width', '100px'); // width should be transformed

      // Check that background-image URL is preserved
      const backgroundImage = await urlElement.evaluate(el =>
        getComputedStyle(el).backgroundImage
      );
      expect(backgroundImage).toContain('image-1rpx.png'); // URL should not be transformed
    });

    test('should not transform rpx in string literals', async ({ page }) => {
      await goto(page, 'edge-cases-rpx');

      const stringElement = await page.locator('#string-rpx');
      await expect(stringElement).toHaveCSS('width', '100px'); // width should be transformed

      // Check content property (if supported)
      const content = await stringElement.evaluate(el =>
        getComputedStyle(el).content
      );
      if (content && content !== 'none') {
        expect(content).toContain('1rpx'); // String content should not be transformed
      }
    });

    test('should work with existing CSS transformations (flex)', async ({ page }) => {
      await goto(page, 'edge-cases-rpx');

      const flexElement = await page.locator('#flex-rpx');
      await expect(flexElement).toHaveCSS('display', 'flex');
      await expect(flexElement).toHaveCSS('margin', '10px');

      // Check flex-basis transformation (might be converted by web-style-transformer)
      await expect(flexElement).toHaveCSS('--flex-basis', 'calc(100 * 1px)'); // 100rpx -> 100px
    });

    test('should handle large rpx values', async ({ page }) => {
      await goto(page, 'edge-cases-rpx');

      const largeElement = await page.locator('#large-rpx');
      await expect(largeElement).toHaveCSS('width', '9999px');
      await expect(largeElement).toHaveCSS('height', '1000px');
    });

    test(
      'should handle very small decimal rpx values', // chrome bug ? 0.1px -> 0.09375px
      () => {
        test.skip(
          'should handle very small decimal rpx values',
          {
            annotation: {
              type: 'browser-diff',
              description: 'Chrome bug? 0.1px -> 0.09375px',
            },
          },
          () => {},
        );
        // async ({ page }) => {

        // await goto(page, 'edge-cases-rpx');

        // const smallElement = await page.locator('#small-decimal-rpx');
        // await expect(smallElement).toHaveCSS('width', '0.1px');
        // await expect(smallElement).toHaveCSS('height', '0.01px');
      },
    );

    test('should handle rpx in transform functions', async ({ page }) => {
      await goto(page, 'edge-cases-rpx');

      const transformElement = await page.locator('#transform-rpx');
      const transform = await transformElement.evaluate(el =>
        getComputedStyle(el).transform
      );

      // Should contain translateX(50px) and translateY(25px)
      // matrix(a, b, c, d, tx, ty)
      const matrixValues = transform.match(/matrix\(([^)]+)\)/)?.[1]?.split(',')
        .map(
          v => parseFloat(v.trim()),
        );
      expect(matrixValues?.[4]).toBeCloseTo(50, 1); // tx
      expect(matrixValues?.[5]).toBeCloseTo(25, 1); // ty
    });

    test('should handle multiple rpx values in one property', async ({ page }) => {
      await goto(page, 'edge-cases-rpx');

      const multipleElement = await page.locator('#multiple-rpx');
      const boxShadow = await multipleElement.evaluate(el =>
        getComputedStyle(el).boxShadow
      );

      // Should transform all rpx values in box-shadow
      expect(boxShadow).toMatch(/1px.*2px.*3px.*4px.*5px.*6px/);
    });
  });
});
