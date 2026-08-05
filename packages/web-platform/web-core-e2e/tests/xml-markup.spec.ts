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
 * A second, minimal card whose only job is to pin down the `:root` limitation
 * documented on the last test in this file.
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

  await page.goto(`/?xmlName=${xmlName}`, { waitUntil: 'load' });
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
    // unset: CSS from markup cards is passed through verbatim instead of being
    // tokenized, so the browser is what resolves `rem` / `vh` / `calc()` here.

    const cardPage = page.locator('lynx-view div.page');

    // `calc(100vw / 24)` against the 393px-wide Pixel 5 viewport, proving the
    // browser really evaluated the expression instead of dropping it.
    expect(await computedStyle(cardPage, 'font-size')).toBe('16.375px');
    expect(await computedStyle(cardPage, 'background-color')).toBe(
      'rgb(237, 244, 239)',
    );

    // Flex layout from the stylesheet, not from a Lynx `display:linear`
    // translation (which markup cards do not get).
    const shell = page.locator('lynx-view .shell');
    expect(await computedStyle(shell, 'display')).toBe('flex');
    expect(await computedStyle(shell, 'flex-direction')).toBe('column');

    // `border-radius: 1.75rem` resolved to 28px, proving `rem` reaches the
    // browser as a live unit rather than being rewritten away. Note `rem`
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

    // Custom properties work, as long as they are declared on a selector that
    // matches inside the card (see the `:root` test at the end of this file).
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
   * Known limitation, asserted on purpose so that it cannot change silently.
   *
   * The CSS of a markup card rides the raw-content channel verbatim and is not
   * tokenized, so - unlike the CSS of a built card - its selectors are never
   * rewritten. `:root` therefore keeps its literal meaning and matches the host
   * document instead of the card's root element, which makes every declaration
   * under it unreachable from the card.
   *
   * This is expected behaviour today, not a bug to patch casually: giving
   * markup cards the rewrite means routing their CSS through the tokenized
   * channel, which is a deliberate design change. If that happens, this test
   * turns red and forces the choice to be made explicitly.
   */
  test('does not rewrite `:root` for markup cards', async ({ page }) => {
    const { consoleErrors, pageErrors } = await gotoMarkupCard(
      page,
      ROOT_SELECTOR_CARD,
      '.probe',
    );

    const cardPage = page.locator('lynx-view div.page');

    // A plain declaration under `:root` never reaches the card's root element.
    expect(await computedStyle(cardPage, 'background-color')).toBe(
      'rgba(0, 0, 0, 0)',
    );
    // Nor is a custom property declared there ever in scope for the card.
    expect(await computedStyle(cardPage, '--root-accent')).toBe('');
    // So `background-color: var(--root-accent)` has nothing to resolve against
    // and the whole declaration is invalid at computed-value time - the element
    // ends up transparent rather than accent-coloured.
    expect(
      await computedStyle(page.locator('lynx-view .probe'), 'background-color'),
    ).toBe('rgba(0, 0, 0, 0)');

    // Control: the identical construct declared on the root element's own class
    // does resolve, which isolates the selector as the cause above instead of
    // custom properties being broken for markup cards in general.
    expect(
      await computedStyle(
        page.locator('lynx-view .control'),
        'background-color',
      ),
    ).toBe('rgb(76, 134, 101)');

    // The limitation is silent: nothing is reported to the page about it.
    expect(consoleErrors).toStrictEqual([]);
    expect(pageErrors).toStrictEqual([]);
  });
});
