// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { test, expect } from '@lynx-js/playwright-fixtures';
import type { ConsoleMessage, Locator, Page } from '@playwright/test';

/**
 * End-to-end coverage for Lynx XML markup ("buildless" / vanilla) cards.
 *
 * Unlike every other case in this suite, the template here is **not** produced
 * by rspeedy: `hangzhou-trip.xml` is hand-written markup that `web-core` sniffs
 * (leading `<`), parses, and translates into a template bundle at load time. The
 * card renders itself through the Element PAPIs from
 * `<script main-thread="true">` after subscribing to the engine's
 * `__RenderPage` event via `lynx.getEngine()`.
 *
 * These tests therefore assert the whole chain end to end: parse -> bundle
 * translation -> engine event dispatch -> Element PAPI tree -> CSS -> event
 * PAPI interaction.
 *
 * The fixture is owned by `web-core/tests/fixtures` (shared with its unit
 * tests) and served over HTTP by `rsbuild.config.ts`'s `publicDir`.
 */

const XML_CARD = 'hangzhou-trip.xml';

const wait = async (ms: number) => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

/**
 * Console messages that are emitted by the harness/runtime regardless of the
 * template being loaded, and so are not evidence of a problem with the card.
 */
const isExpectedConsoleNoise = (message: ConsoleMessage) =>
  message.type() !== 'error';

/**
 * Load the markup card and start recording anything the page complains about.
 *
 * The listener is attached before navigation so nothing emitted during load is
 * missed.
 */
const gotoXMLCard = async (page: Page) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (!isExpectedConsoleNoise(message)) {
      consoleErrors.push(`[${message.type()}] ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.goto(`/?xmlName=${XML_CARD}`, { waitUntil: 'load' });
  // The card only appears once the decode worker has parsed the markup and the
  // main-thread script has answered `__RenderPage`, which is asynchronous with
  // respect to `load`.
  await page.locator('lynx-view .day-panel').first().waitFor();
  return { consoleErrors, pageErrors };
};

const dayTabs = (page: Page): Locator => page.locator('lynx-view .day-tab');

const computedStyle = (locator: Locator, property: string) =>
  locator.evaluate(
    (element, prop) => getComputedStyle(element).getPropertyValue(prop),
    property,
  );

test.describe('Lynx XML markup card', () => {
  // The markup loading path is engine-level and browser-agnostic; one engine is
  // enough to prove it, and only chromium is provisioned for it.
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== 'chromium', 'markup e2e runs on chromium only');
  });

  test('renders the element tree built by the main-thread script', async ({ page }) => {
    const { consoleErrors, pageErrors } = await gotoXMLCard(page);

    // The card root is a `page` element carrying the class set by the script.
    await expect(page.locator('lynx-view div.page')).toHaveCount(1);
    // `__CreateScrollView` -> `<scroll-view>`, and it must actually be
    // scrollable rather than a plain box.
    const scrollView = page.locator('lynx-view scroll-view.page-scroll');
    await expect(scrollView).toHaveCount(1);
    await expect(scrollView).toHaveAttribute('scroll-orientation', 'vertical');
    expect(await computedStyle(scrollView, 'overflow-y')).toBe('scroll');

    // Each structural region the script builds must be present exactly once.
    for (
      const section of [
        '.hero',
        '.hero-stats',
        '.tabs-section',
        '.day-slot',
        '.day-panel',
        '.day-meta',
        '.route-list',
        '.tip-card',
        '.footer',
      ]
    ) {
      await expect(page.locator(`lynx-view ${section}`)).toHaveCount(1);
    }

    // `__CreateView` / `__CreateText` map onto `x-view` / `x-text`, and every
    // `x-text` gets a `raw-text` child from `__CreateRawText`.
    await expect(page.locator('lynx-view x-view')).toHaveCount(60);
    await expect(page.locator('lynx-view x-text')).toHaveCount(48);
    await expect(page.locator('lynx-view x-text > raw-text')).toHaveCount(48);

    // Day 1 is the initially selected tab, so its four itinerary rows render.
    await expect(page.locator('lynx-view .route-item')).toHaveCount(4);
    await expect(page.locator('lynx-view .day-tab')).toHaveCount(3);

    expect(consoleErrors).toStrictEqual([]);
    expect(pageErrors).toStrictEqual([]);
  });

  test('renders the card copy, including multi-line and attribute text', async ({ page }) => {
    await gotoXMLCard(page);

    // Hero copy. `__CreateRawText` receives an embedded newline here, which
    // must survive as text rather than being collapsed away or escaped.
    await expect(page.locator('lynx-view .hero-title')).toHaveText(
      '山水入城\n三日漫游',
    );
    await expect(page.locator('lynx-view .hero-kicker')).toHaveText(
      'CITY ESCAPE · 03 DAYS',
    );
    await expect(page.locator('lynx-view .hero-badge-text')).toHaveText(
      '杭州 HANGZHOU',
    );

    // Day 1 panel copy, driven by the `days` array in the main-thread script.
    await expect(page.locator('lynx-view .day-title')).toHaveText('西湖慢游');
    await expect(page.locator('lynx-view .day-eyebrow')).toHaveText(
      'DAY 01 · 湖光初见',
    );
    await expect(page.locator('lynx-view .day-number')).toHaveText('01');
    await expect(page.locator('lynx-view .route-place')).toHaveText([
      '断桥残雪 · 白堤',
      '孤山 · 浙江博物馆',
      '曲院风荷 · 苏堤',
      '湖滨 · 音乐喷泉',
    ]);
    await expect(page.locator('lynx-view .tip-title')).toHaveText(
      '出发前的小提示',
    );
    await expect(page.locator('lynx-view .footer-mark')).toHaveText(
      'HANGZHOU · 杭州',
    );

    // All three tab labels come from the same data, so the not-yet-rendered
    // days are still observable up front.
    await expect(page.locator('lynx-view .day-tab-name')).toHaveText([
      '湖光',
      '茶山',
      '宋韵',
    ]);

    // `__SetAttribute` with a string value lands on the DOM element.
    await expect(dayTabs(page).nth(0)).toHaveAttribute(
      'aria-label',
      '查看第 1 天行程：湖光',
    );
  });

  test('applies the CSS carried by the markup <style> section', async ({ page }) => {
    await gotoXMLCard(page);

    // `transform-vw` / `transform-vh` / `transform-rem` are deliberately left
    // unset: CSS from markup cards is passed through verbatim instead of being
    // tokenized, so the browser is what resolves `rem` / `vh` / `calc()` here.

    // `calc(100vw / 23.4375)` against the 393px-wide Pixel 5 viewport.
    const cardPage = page.locator('lynx-view div.page');
    expect(await computedStyle(cardPage, 'font-size')).toBe('16.768px');
    expect(await computedStyle(cardPage, 'background-color')).toBe(
      'rgb(237, 244, 239)',
    );

    // Flex layout from the stylesheet, not from a Lynx `display:linear`
    // translation (which markup cards do not get).
    const appShell = page.locator('lynx-view .app-shell');
    expect(await computedStyle(appShell, 'display')).toBe('flex');
    expect(await computedStyle(appShell, 'flex-direction')).toBe('column');
    expect(await computedStyle(appShell, 'align-items')).toBe('center');

    // `border-radius: 1.75rem` resolved against the `calc()`-derived root font
    // size, proving `rem` units really are live.
    const tripCard = page.locator('lynx-view .trip-card');
    expect(await computedStyle(tripCard, 'border-radius')).toBe('28px');
    expect(await computedStyle(tripCard, 'overflow')).toBe('hidden');

    // A gradient background survives the pass-through unmangled.
    expect(
      await computedStyle(page.locator('lynx-view .hero'), 'background-image'),
    )
      .toBe(
        'linear-gradient(145deg, rgb(18, 63, 53) 0%, rgb(23, 97, 79) 58%, rgb(76, 134, 101) 100%)',
      );

    // The `.active` compound selector is applied to the selected tab only.
    const activeTab = page.locator('lynx-view .day-tab.active');
    await expect(activeTab).toHaveCount(1);
    expect(await computedStyle(activeTab, 'background-color')).toBe(
      'rgb(255, 255, 255)',
    );
  });

  test('switches day panels when a tab is tapped', async ({ page }) => {
    const { consoleErrors, pageErrors } = await gotoXMLCard(page);
    const tabs = dayTabs(page);

    // Baseline: day 1 selected.
    await expect(page.locator('lynx-view .day-title')).toHaveText('西湖慢游');
    await expect(tabs.nth(0)).toHaveClass(/\bactive\b/);

    // Tapping day 2 exercises the `__AddEventListener` function callback, which
    // calls `__ReplaceElements` + `__SetClasses` + `__FlushElementTree`.
    await tabs.nth(1).click();
    await expect(page.locator('lynx-view .day-title')).toHaveText('灵隐与龙井');
    await expect(page.locator('lynx-view .day-eyebrow')).toHaveText(
      'DAY 02 · 山寺茶香',
    );
    await expect(page.locator('lynx-view .route-place')).toHaveText([
      '灵隐寺 · 飞来峰',
      '天竺路 · 素面小馆',
      '龙井村 · 九溪烟树',
      '河坊街 · 南宋御街',
    ]);
    // `__SetClasses` moved the active marker instead of adding a second one.
    await expect(page.locator('lynx-view .day-tab.active')).toHaveCount(1);
    await expect(tabs.nth(1)).toHaveClass(/\bactive\b/);
    await expect(tabs.nth(0)).not.toHaveClass(/\bactive\b/);

    await tabs.nth(2).click();
    await expect(page.locator('lynx-view .day-title')).toHaveText('古今杭城');
    await expect(page.locator('lynx-view .day-eyebrow')).toHaveText(
      'DAY 03 · 运河宋韵',
    );

    // Going back proves the replaced subtree is rebuilt, not merely hidden.
    await tabs.nth(0).click();
    await expect(page.locator('lynx-view .day-title')).toHaveText('西湖慢游');
    await expect(page.locator('lynx-view .route-place').first()).toHaveText(
      '断桥残雪 · 白堤',
    );

    // `__ReplaceElements` must swap the panel rather than accumulate panels, so
    // repeated switching may not grow the tree.
    await expect(page.locator('lynx-view .day-panel')).toHaveCount(1);
    await expect(page.locator('lynx-view .route-item')).toHaveCount(4);
    await expect(page.locator('lynx-view x-view')).toHaveCount(60);

    expect(consoleErrors).toStrictEqual([]);
    expect(pageErrors).toStrictEqual([]);
  });

  test('tears the card down without errors', async ({ page }) => {
    const { consoleErrors, pageErrors } = await gotoXMLCard(page);

    // Removing the host triggers `__DestroyLifetime` on the engine context and
    // the background-thread dispose RPC. Markup cards never install ReactLynx's
    // `tt.callDestroyLifetimeFun`, so this is where a hard dependency on that
    // hook would surface.
    await page.evaluate(() => {
      document.querySelector('lynx-view')?.remove();
    });
    await wait(500);

    expect(consoleErrors).toStrictEqual([]);
    expect(pageErrors).toStrictEqual([]);
  });

  test('matches the reference rendering', async ({ page }) => {
    await gotoXMLCard(page);
    // Let the gradients/shadows settle before sampling pixels.
    await wait(300);
    await expect(page).toHaveScreenshot(['xml-markup', 'hangzhou-trip.png'], {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });
});
