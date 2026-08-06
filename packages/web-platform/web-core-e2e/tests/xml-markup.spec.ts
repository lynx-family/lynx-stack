// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { test, expect } from '@lynx-js/playwright-fixtures';
import type { ConsoleMessage, Locator, Page } from '@playwright/test';

/**
 * End-to-end coverage for Lynx XML markup ("buildless" / vanilla) cards.
 *
 * Unlike every other case in this suite, the template here is **not** produced
 * by rspeedy: `markup-card.xml` is hand-written markup that `web-core` sniffs
 * (leading `<`), parses, and translates into a template bundle at load time. The
 * card renders itself through the Element PAPIs from
 * `<script main-thread="true">` after subscribing to the engine's
 * `__RenderPage` event via `lynx.getEngine()`.
 *
 * These tests therefore assert the whole chain end to end: parse -> bundle
 * translation -> engine event dispatch -> Element PAPI tree -> CSS -> event
 * PAPI interaction.
 *
 * The fixtures are owned by `web-core/tests/fixtures` (shared with its unit
 * tests) and served over HTTP by `rsbuild.config.ts`'s `publicDir`.
 */

const XML_CARD = 'markup-card.xml';

/**
 * A second, minimal card covering `:root` rewriting and `@media` preservation,
 * asserted by the last tests in this file.
 */
const ROOT_SELECTOR_CARD = 'markup-root-selector.xml';

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
 * Load a markup card and start recording anything the page complains about.
 *
 * The listener is attached before navigation so nothing emitted during load is
 * missed.
 */
const gotoMarkupCard = async (
  page: Page,
  xmlName: string,
  readySelector: string,
  /**
   * Extra query parameters, used to switch on the shell's `transform-*`
   * attributes for the tests that assert unit rewriting.
   */
  options: Record<string, string> = {},
) => {
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

  const query = new URLSearchParams({ xmlName, ...options });
  await page.goto(`/?${query.toString()}`, { waitUntil: 'load' });
  // The card only appears once the decode worker has parsed the markup and the
  // main-thread script has answered `__RenderPage`, which is asynchronous with
  // respect to `load`.
  await page.locator(`lynx-view ${readySelector}`).first().waitFor();
  return { consoleErrors, pageErrors };
};

const gotoXMLCard = (page: Page) => gotoMarkupCard(page, XML_CARD, '.panel');

const dayTabs = (page: Page): Locator => page.locator('lynx-view .tab');

const computedStyle = (locator: Locator, property: string) =>
  locator.evaluate(
    (element, prop) => getComputedStyle(element).getPropertyValue(prop),
    property,
  );

/**
 * How many line boxes the raw text of `locator` occupies, counted from the
 * client rects of its text node grouped by vertical offset.
 *
 * `toHaveText` / `innerText` normalize whitespace, so they report the same value
 * whether a string contains a newline or a plain space. Counting laid-out lines
 * is what distinguishes "the break reached the DOM" from "the break was
 * silently collapsed".
 */
const renderedLineCount = (locator: Locator) =>
  locator.evaluate((element) => {
    const textNode = element.firstChild;
    if (!textNode) {
      return 0;
    }
    const range = document.createRange();
    range.selectNodeContents(textNode);
    const tops = Array.from(range.getClientRects(), (rect) =>
      Math.round(rect.top));
    return new Set(tops).size;
  });

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
    const scrollView = page.locator('lynx-view scroll-view');
    await expect(scrollView).toHaveCount(1);
    await expect(scrollView).toHaveAttribute('scroll-orientation', 'vertical');
    expect(await computedStyle(scrollView, 'overflow-y')).toBe('scroll');

    // Each structural region the script builds must be present exactly once.
    for (
      const section of ['.shell', '.card', '.tabs', '.panel-slot', '.panel']
    ) {
      await expect(page.locator(`lynx-view ${section}`)).toHaveCount(1);
    }

    // The regions nest the way the script assembles them, so a flat "each one
    // exists" check would still pass if the tree were assembled incorrectly.
    for (
      const [parent, child] of [
        ['scroll-view', '.shell'],
        ['.shell', '.card'],
        ['.card', '.tabs'],
        ['.card', '.panel-slot'],
        ['.panel-slot', '.panel'],
      ] as const
    ) {
      await expect(page.locator(`lynx-view ${parent} > ${child}`)).toHaveCount(
        1,
      );
    }

    // `__CreateView` / `__CreateText` map onto `x-view` / `x-text`, and every
    // `x-text` gets a `raw-text` child from `__CreateRawText`.
    await expect(page.locator('lynx-view x-view')).toHaveCount(8);
    await expect(page.locator('lynx-view x-text')).toHaveCount(6);
    await expect(page.locator('lynx-view x-text > raw-text')).toHaveCount(6);

    // Three tabs are built up front; only the selected day's panel is built.
    await expect(dayTabs(page)).toHaveCount(3);
    await expect(page.locator('lynx-view .tab > .title')).toHaveCount(3);
    await expect(page.locator('lynx-view .panel > .title')).toHaveCount(1);
    await expect(page.locator('lynx-view .panel > .detail')).toHaveCount(1);

    expect(consoleErrors).toStrictEqual([]);
    expect(pageErrors).toStrictEqual([]);
  });

  test('renders the card copy driven by the main-thread data', async ({ page }) => {
    await gotoXMLCard(page);

    // Card heading, appended directly to `.card` rather than to a panel, so
    // scoping the locator keeps it distinct from the same-classed titles below.
    await expect(page.locator('lynx-view .card > .title')).toHaveText(
      'City escape',
    );

    // All three tab labels come from the same `days` array, so the days whose
    // panels are not built yet are still observable up front.
    await expect(page.locator('lynx-view .tab > .title')).toHaveText([
      'Day 1',
      'Day 2',
      'Day 3',
    ]);

    // Day 1 panel copy. Both texts come from `__CreateRawText`, and the
    // sentence carries the punctuation and spacing verbatim.
    await expect(page.locator('lynx-view .panel > .title')).toHaveText(
      'Lakeside',
    );
    const detail = page.locator('lynx-view .panel > .detail');
    const detailRawText = page.locator('lynx-view .panel > .detail > raw-text');

    // Day 1's detail carries an embedded newline, which must survive as a break
    // rather than being collapsed into a space or escaped into a literal `\n`.
    // `toHaveText` normalizes whitespace and so cannot tell those apart - it
    // passes for the space-joined string too - hence the raw `textContent`.
    await expect(detail).toHaveText('Walk the causeway at sunrise.');
    expect(await detail.evaluate((element) => element.textContent)).toBe(
      'Walk the causeway\nat sunrise.',
    );

    // `__CreateRawText` also mirrors its value onto the `text` attribute, so the
    // text is observable as an attribute and not only as a text node.
    await expect(detailRawText).toHaveAttribute(
      'text',
      'Walk the causeway\nat sunrise.',
    );

    // And the break is honoured by layout, not merely present in the string:
    // two line boxes here versus one for the days whose copy has no newline.
    expect(await renderedLineCount(detailRawText)).toBe(2);
  });

  test('applies the CSS carried by the markup <style> section', async ({ page }) => {
    await gotoXMLCard(page);

    // `transform-vw` / `transform-vh` / `transform-rem` are deliberately left
    // unset here, which is the default: the card's CSS is tokenized either way,
    // but with the attributes off the units keep their native browser meaning,
    // so the browser is what resolves `rem` / `vh` / `calc()` below. The
    // `transform-rem` test at the end of this file covers the opt-in.

    const cardPage = page.locator('lynx-view div.page');

    // `calc(100vw / 24)` against the 393px-wide Pixel 5 viewport, proving the
    // browser really evaluated the expression instead of dropping it.
    expect(await computedStyle(cardPage, 'font-size')).toBe('16.375px');
    expect(await computedStyle(cardPage, 'background-color')).toBe(
      'rgb(237, 244, 239)',
    );

    // Flex layout from the stylesheet's own `display: flex`. The card does not
    // use Lynx's `display: linear`, which tokenization would also translate.
    const shell = page.locator('lynx-view .shell');
    expect(await computedStyle(shell, 'display')).toBe('flex');
    expect(await computedStyle(shell, 'flex-direction')).toBe('column');

    // `border-radius: 1.75rem` resolved to 28px, proving `rem` reaches the
    // browser as a live unit because `transform-rem` is off. Note `rem`
    // resolves against the *document* root font size, which keeps the 16px
    // default here - not against `.page`'s `calc()`-derived size, which only
    // affects `em` and font-relative lengths inside the card.
    const card = page.locator('lynx-view .card');
    expect(await computedStyle(card, 'border-radius')).toBe('28px');
    expect(await computedStyle(card, 'overflow')).toBe('hidden');

    // A gradient background survives the pass-through unmangled: the angle,
    // both stops and both positions all come back intact.
    expect(await computedStyle(card, 'background-image')).toBe(
      'linear-gradient(145deg, rgb(18, 63, 53) 0%, rgb(76, 134, 101) 100%)',
    );

    // Custom properties resolve for a markup card.
    // `.tab-active` only sets `background-color: var(--accent)`, so resolving to
    // the accent colour is only possible if the variable was really in scope -
    // an unresolvable `var()` would leave the declaration invalid at
    // computed-value time and fall back to transparent.
    expect(await computedStyle(cardPage, '--accent')).toBe('#2f6d54');
    const activeTab = page.locator('lynx-view .tab.tab-active');
    await expect(activeTab).toHaveCount(1);
    expect(await computedStyle(activeTab, 'background-color')).toBe(
      'rgb(47, 109, 84)',
    );
    // The unselected tabs keep the base `.tab` background, so the assertion
    // above is specific to the compound `.tab.tab-active` rule.
    expect(
      await computedStyle(dayTabs(page).nth(1), 'background-color'),
    ).toBe('rgba(255, 255, 255, 0.09)');
  });

  test('switches day panels when a tab is tapped', async ({ page }) => {
    const { consoleErrors, pageErrors } = await gotoXMLCard(page);
    const tabs = dayTabs(page);
    const panelTitle = page.locator('lynx-view .panel > .title');
    const panelDetail = page.locator('lynx-view .panel > .detail');

    // Baseline: day 1 selected.
    await expect(panelTitle).toHaveText('Lakeside');
    await expect(tabs.nth(0)).toHaveClass(/\btab-active\b/);

    // Tapping day 2 exercises the `__AddEventListener` function callback, which
    // calls `__ReplaceElements` + `__SetClasses` + `__FlushElementTree`.
    await tabs.nth(1).click();
    await expect(panelTitle).toHaveText('Tea hills');
    await expect(panelDetail).toHaveText('Climb between the tea rows.');
    // `__SetClasses` moved the active marker instead of adding a second one.
    await expect(page.locator('lynx-view .tab.tab-active')).toHaveCount(1);
    await expect(tabs.nth(1)).toHaveClass(/\btab-active\b/);
    await expect(tabs.nth(0)).not.toHaveClass(/\btab-active\b/);
    // The class swap is what drives the highlight, so the accent must follow the
    // marker rather than staying on the originally selected tab.
    expect(
      await computedStyle(tabs.nth(1), 'background-color'),
    ).toBe('rgb(47, 109, 84)');
    expect(
      await computedStyle(tabs.nth(0), 'background-color'),
    ).toBe('rgba(255, 255, 255, 0.09)');

    await tabs.nth(2).click();
    await expect(panelTitle).toHaveText('Old town');
    await expect(panelDetail).toHaveText('Follow the canal after dusk.');

    // Going back proves the replaced subtree is rebuilt, not merely hidden. The
    // newline in day 1's copy has to survive being rebuilt too, so it is
    // re-checked on the text node rather than through whitespace-normalizing
    // `toHaveText`.
    await tabs.nth(0).click();
    await expect(panelTitle).toHaveText('Lakeside');
    expect(await panelDetail.evaluate((element) => element.textContent)).toBe(
      'Walk the causeway\nat sunrise.',
    );

    // `__ReplaceElements` must swap the panel rather than accumulate panels, so
    // repeated switching may not grow the tree.
    await expect(page.locator('lynx-view .panel')).toHaveCount(1);
    await expect(page.locator('lynx-view x-view')).toHaveCount(8);
    await expect(page.locator('lynx-view x-text')).toHaveCount(6);

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
    await expect(page).toHaveScreenshot(['xml-markup', 'markup-card.png'], {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });

  /**
   * `:root` is rewritten to the card's own root element, because a markup card's
   * CSS is tokenized on the way in.
   *
   * A card renders inside a shadow root, where a literal `:root` matches
   * nothing, so without the rewrite every declaration under it - custom
   * properties included - would be unreachable, and silently so.
   */
  test('rewrites `:root` for markup cards', async ({ page }) => {
    const { consoleErrors, pageErrors } = await gotoMarkupCard(
      page,
      ROOT_SELECTOR_CARD,
      '.probe',
    );

    const cardPage = page.locator('lynx-view div.page');

    // A plain declaration under `:root` reaches the card's root element.
    expect(await computedStyle(cardPage, 'background-color')).toBe(
      'rgb(47, 109, 84)',
    );
    // And a custom property declared there is in scope for the card.
    expect(await computedStyle(cardPage, '--root-accent')).toBe('#2f6d54');
    // So `background-color: var(--root-accent)` resolves. An unresolvable
    // `var()` would leave the declaration invalid at computed-value time and the
    // element transparent, which is what this asserts against.
    expect(
      await computedStyle(page.locator('lynx-view .probe'), 'background-color'),
    ).toBe('rgb(47, 109, 84)');

    // Control: the same construct declared on the root element's own class. Both
    // resolving is what shows the rewrite happened, rather than the card having
    // avoided `:root`.
    expect(
      await computedStyle(
        page.locator('lynx-view .control'),
        'background-color',
      ),
    ).toBe('rgb(76, 134, 101)');

    expect(consoleErrors).toStrictEqual([]);
    expect(pageErrors).toStrictEqual([]);
  });

  /**
   * The remaining limitation, asserted so that it cannot change silently.
   *
   * `@media` / `@supports` / `@layer` have no representation in the binary style
   * format, whose rule kinds are only `StyleRule` / `FontFaceRule` /
   * `KeyframesRule`. They are therefore kept verbatim and honoured by the
   * browser - dropping them would be a silent capability loss - but the CSS
   * inside such a block is consequently not tokenized.
   */
  test('preserves an `@media` block for markup cards', async ({ page }) => {
    const { consoleErrors, pageErrors } = await gotoMarkupCard(
      page,
      ROOT_SELECTOR_CARD,
      '.probe',
    );

    // The block's query always matches, so its declaration must be in effect.
    // Had the at-rule been dropped on the way in, this element would have no
    // background at all.
    expect(
      await computedStyle(
        page.locator('lynx-view .preserved'),
        'background-color',
      ),
    ).toBe('rgb(18, 63, 53)');

    expect(consoleErrors).toStrictEqual([]);
    expect(pageErrors).toStrictEqual([]);
  });

  /**
   * `transform-rem` reaches a markup card, which is only possible because its
   * CSS is tokenized: the rewrite of `1.75rem` into
   * `calc(1.75 * var(--rem-unit))` happens while tokenizing, so on the raw
   * `content` channel the attribute had no effect at all.
   *
   * `--rem-unit` itself is the embedder's to define - that is the point of the
   * feature, per the `transformREM` release note - so the test sets it and
   * asserts the card's lengths follow it.
   */
  test('honours `transform-rem` on a markup card', async ({ page }) => {
    await gotoMarkupCard(page, XML_CARD, '.panel', {
      'transform-rem': 'true',
    });

    const card = page.locator('lynx-view .card');

    // 10px per rem: `border-radius: 1.75rem` must resolve to 17.5px. Without the
    // rewrite the declaration would keep its native meaning and land on 28px
    // (16px document default), which is what the default-attributes test above
    // asserts - so this value can only be produced by the rewrite.
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--rem-unit', '10px');
    });
    expect(await computedStyle(card, 'border-radius')).toBe('17.5px');

    // Driving the same declaration to a second value proves the length really
    // tracks the variable, rather than having coincidentally matched once.
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--rem-unit', '20px');
    });
    expect(await computedStyle(card, 'border-radius')).toBe('35px');
  });
});
