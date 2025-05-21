import { test, expect } from './coverage-fixture.js';
import type { Page } from '@playwright/test';

const wait = async (ms: number) => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const diffScreenShot = async (
  page: Page,
  caseName: string,
  subcaseName: string,
  label: string = 'index',
  screenshotOptions?: Parameters<
    ReturnType<typeof expect<Page>>['toHaveScreenshot']
  >[0],
) => {
  await expect(page).toHaveScreenshot([
    `${caseName}`,
    `${subcaseName}`,
    `${label}.png`,
  ], {
    maxDiffPixelRatio: 0,
    fullPage: true,
    animations: 'allow',
    ...screenshotOptions,
  });
};

const goto = async (
  page: Page,
  testname: string,
  hasDir?: boolean,
) => {
  let url = `/fp-only?casename=${testname}`;
  if (hasDir) {
    url += '&hasdir=true';
  }
  await page.goto(url, {
    waitUntil: 'load',
  });
  await page.evaluate(() => document.fonts.ready);
};

test.describe('SSR no Javascript tests', () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName === 'firefox', 'firefox does not support @container');
  });
  test.describe('basic', () => {
    test('api-initdata', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(100);
      await expect(page.locator('#target')).toHaveCSS(
        'background-color',
        'rgb(0, 128, 0)',
      ); // green;
    });
    test('basic-pink-rect', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(100);
      const target = await page.locator('#target');
      await expect(target).toHaveCSS('height', '100px');
      await expect(target).toHaveCSS('width', '100px');
      await expect(target).toHaveCSS('background-color', 'rgb(255, 192, 203)');
    });
    test('basic-class-selector', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(100);
      const computedStyle = await page.locator('#target').evaluate((dom) => {
        const style = getComputedStyle(dom);
        const height = style.height;
        const width = style.width;
        const backgroundColor = style.backgroundColor;
        return {
          height,
          width,
          backgroundColor,
        };
      });
      expect(computedStyle.height).toBe('100px');
      expect(computedStyle.width).toBe('100px');
      expect(computedStyle.backgroundColor).toBe('rgb(255, 192, 203)');
    });
    test.fixme('basic-globalProps', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(100);
      expect(await page.locator('#target').getAttribute('style')).toContain(
        'pink',
      );
    });

    test.fixme('basic-dataprocessor', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(100);
      expect(await page.locator('#target').getAttribute('style')).toContain(
        'green',
      );
    });
    test('basic-list-rendering', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(100);
      await expect(
        page.locator('#pink'),
      ).toHaveAttribute('style', /pink/g);
      await expect(
        page.locator('#orange'),
      ).toHaveAttribute('style', /orange/g);
      await expect(
        page.locator('#wheat'),
      ).toHaveAttribute('style', /wheat/g);
    });

    test(
      'basic-wrapper-element-do-not-impact-layout',
      async ({ page }, { title }) => {
        await goto(page, title);
        await wait(100);
        await expect(
          page.locator('#pink'),
        ).toHaveCSS('width', '60px');
        await expect(
          page.locator('#parent > * > #orange'),
        ).toHaveCSS('width', '60px');
        await expect(
          page.locator('#parent > * > #wheat'),
        ).toHaveCSS('width', '60px');
      },
    );
    test('basic-style-combinator', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(100);
      const target = page.locator('#target');
      await expect(target).toHaveCSS('background-color', 'rgb(0, 128, 0)'); // green
    });
    test('basic-style-root-selector', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(100);
      const target = page.locator('#target');
      await expect(target).toHaveCSS('background-color', 'rgb(0, 128, 0)'); // green
    });
    test('basic-image', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(100);
      const target = await page.locator('#target');
      await expect(target).toHaveCSS('height', '100px');
      await expect(target).toHaveCSS('width', '100px');
    });
    test('basic-scroll-view', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(100);
      const target = await page.locator('#target');
      await expect(target).toHaveCSS('height', '100px');
      await expect(target).toHaveCSS('width', '100px');
      await expect(target).toHaveCSS('background-color', 'rgb(255, 192, 203)');
    });
  });

  test.describe('basic-css', () => {
    test('basic-css-asset-in-css', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(500);
      await diffScreenShot(page, title, 'show-lynx-logo');
    });
    test('basic-css-var', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(100);
      const computedStyle = await page.locator('#target').evaluate((dom) => {
        const style = getComputedStyle(dom);
        const backgroundColor = style.backgroundColor;
        return {
          backgroundColor,
        };
      });
      expect(computedStyle.backgroundColor).toBe('rgb(255, 192, 203)');
    });
    test('basic-color-not-inherit', async ({ page }, { title }) => {
      await goto(page, title);
      await wait(100);
      await expect(page.locator('#target')).toHaveCSS('color', 'rgb(0, 0, 0)');
    });
  });
  test.describe('configs', () => {
    test(
      'config-css-remove-scope-false',
      async ({ page }, { title }) => {
        await goto(page, title);
        await wait(100);
        await expect(
          page.locator('#index'),
        ).toHaveCSS('background-color', 'rgb(255, 0, 0)');
        await expect(
          page.locator('#sub'),
        ).toHaveCSS('background-color', 'rgb(0, 128, 0)');
      },
    );
    test(
      'config-css-remove-scope-true',
      async ({ page }, { title }) => {
        await goto(page, title);
        await wait(100);
        await expect(
          page.locator('#index'),
        ).toHaveCSS('background-color', 'rgb(0, 128, 0)');
        await expect(
          page.locator('#sub'),
        ).toHaveCSS('background-color', 'rgb(0, 128, 0)');
      },
    );
    test(
      'config-css-selector-false-multi-level-selector',
      async ({ page }, { title }) => {
        await goto(page, title);
        await wait(100);
        const target = page.locator('#target');
        await expect(target).toHaveCSS(
          'background-color',
          'rgb(255, 192, 203)',
        ); // pink
      },
    );
    test(
      'config-css-selector-false-type-selector',
      async ({ page }, { title }) => {
        await goto(page, title);
        await wait(100);
        const target = page.locator('#target');
        await expect(target).toHaveCSS('background-color', 'rgb(255, 255, 0)'); // yellow
        await expect(target).toHaveCSS('width', '100px');
        await expect(target).toHaveCSS('height', '100px');
      },
    );

    test(
      'config-css-default-overflow-visible-unset',
      async ({ page }, { title }) => {
        await goto(page, title);
        await diffScreenShot(
          page,
          title,
          'index',
        );
      },
    );
  });
  test.describe('elements', () => {
  });
});
