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
    test.skip(browserName === 'firefox', 'firefox does not support @conatiner');
  });
  test.describe('basic', () => {
    test.fixme('api-initdata', async ({ page }, { title }) => {
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
  test.describe.fixme('configs', () => {
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
      'config-css-selector-false-exchange-class',
      async ({ page }, { title }) => {
        await goto(page, title);
        await wait(100);
        const target = page.locator('#target');
        await expect(target).toHaveCSS('background-color', 'rgb(0, 128, 0)'); // green
        await target.click();
        await expect(target).toHaveCSS('background-color', 'rgb(255, 255, 0)'); // yellow
        await target.click();
        await expect(target).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)'); // unset
      },
    );
    test(
      'config-css-selector-false-inline-css-change-same-time',
      async ({ page }, { title }) => {
        await goto(page, title);
        await wait(100);
        const target = page.locator('#target');
        await expect(target).toHaveCSS('background-color', 'rgb(255, 255, 0)'); // yellow
        await target.click();
        await expect(target).toHaveCSS('background-color', 'rgb(255, 0, 0)'); // red
        await target.click();
        await expect(target).toHaveCSS('background-color', 'rgb(255, 255, 0)'); // yellow
      },
    );
    test(
      'config-css-selector-false-inline-remove-css-remove-inline',
      async ({ page }, { title }) => {
        await goto(page, title);
        await wait(100);
        const target = page.locator('#target');
        await expect(target).toHaveCSS('background-color', 'rgb(0, 128, 0)'); // green
        await target.click();
        await expect(target).toHaveCSS('background-color', 'rgb(255, 0, 0)'); // red
        await target.click();
        await expect(target).toHaveCSS('background-color', 'rgb(255, 0, 0)'); // red
        await target.click();
        await expect(target).toHaveCSS('background-color', 'rgb(255, 255, 0)'); // yellow
        await target.click();
        await expect(target).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)'); // unset
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
      'config-css-selector-false-remove-all',
      async ({ page }, { title }) => {
        await goto(page, title);
        await wait(100);
        const target = page.locator('#target');
        await expect(target).toHaveCSS('background-color', 'rgb(0, 128, 0)'); // green
        await target.click();
        await expect(target).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)'); // unset
      },
    );
    test(
      'config-css-selector-false-remove-css-and-reuse-css',
      async ({ page }, { title }) => {
        await goto(page, title);
        await wait(100);
        const target = page.locator('#target');
        await expect(target).toHaveCSS('background-color', 'rgb(255, 255, 0)'); // yellow
        await target.click();
        await expect(target).toHaveCSS('background-color', 'rgb(0, 128, 0)'); // green
        await target.click();
        await expect(target).toHaveCSS('background-color', 'rgb(255, 255, 0)'); // yellow
      },
    );
    test(
      'config-css-selector-false-remove-css-and-style-collapsed',
      async ({ page }, { title }) => {
        await goto(page, title);
        await wait(100);
        const target = page.locator('#target');
        await expect(target).toHaveCSS('background-color', 'rgb(0, 128, 0)'); // green
        await target.click();
        await expect(target).toHaveCSS('background-color', 'rgb(255, 255, 0)'); // yellow
        await target.click();
        await expect(target).toHaveCSS('background-color', 'rgb(0, 128, 0)'); // green
      },
    );
    test(
      'config-css-selector-false-remove-inline-style-and-reuse-css',
      async ({ page }, { title }) => {
        await goto(page, title);
        await wait(100);
        const target = page.locator('#target');
        await expect(target).toHaveCSS('background-color', 'rgb(0, 128, 0)'); // green
        await target.click();
        await expect(target).toHaveCSS('background-color', 'rgb(255, 0, 0)'); // red
        await target.click();
        await expect(target).toHaveCSS('background-color', 'rgb(0, 128, 0)'); // green
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
      'config-splitchunk-single-vendor',
      async ({ page }, { title }) => {
        test.skip(ALL_ON_UI, 'main thread do not support importScript');
        await goto(page, title, undefined, true);
        await wait(1500);
        const target = page.locator('#target');
        await expect(target).toHaveCSS('background-color', 'rgb(0, 128, 0)'); // green
      },
    );
    test(
      'config-splitchunk-split-by-experience',
      async ({ page }, { title }) => {
        test.skip(ALL_ON_UI, 'main thread do not support importScript');
        await goto(page, title, undefined, true);
        await wait(1500);
        const target = page.locator('#target');
        await expect(target).toHaveCSS('background-color', 'rgb(0, 128, 0)'); // green
      },
    );
    test(
      'config-splitchunk-split-by-module',
      async ({ page }, { title }) => {
        test.skip(ALL_ON_UI, 'main thread do not support importScript');
        await goto(page, title, undefined, true);
        await wait(1500);
        const target = page.locator('#target');
        await expect(target).toHaveCSS('background-color', 'rgb(0, 128, 0)'); // green
      },
    );

    test('config-mode-dev-with-all-in-one', async ({ page }, { title }) => {
      await goto(page, title, undefined, true);
      await wait(100);
      const target = page.locator('#target');
      await target.click();
      await expect(await target.getAttribute('style')).toContain('green');
      await target.click();
      await expect(await target.getAttribute('style')).toContain('pink');
    });

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
  test.describe.fixme('elements', () => {
    test.describe('lynx-view', () => {
      const elementName = 'lynx-view';
      test('basic-element-lynx-view-not-auto', async ({ page }, { title }) => {
        await goto(page, title);
        await page.evaluate(() => {
          document.querySelector('lynx-view')!.setAttribute('width', '100vw');
          document.querySelector('lynx-view')!.setAttribute('height', '100vh');
          document.querySelector('lynx-view')!.setAttribute(
            'style',
            'width: 100vw; height: 100vh',
          );
        });
        await wait(100);
        await diffScreenShot(
          page,
          elementName,
          title,
        );
      });
    });
  });
});
