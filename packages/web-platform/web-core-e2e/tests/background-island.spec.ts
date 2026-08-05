// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { expect, test } from '@lynx-js/playwright-fixtures';
import type { Page } from '@playwright/test';

/**
 * `<Background>` islands, end to end.
 *
 * Each case is screenshotted twice: once while the background thread is held
 * back — so what is on screen is exactly what the *main thread alone* built
 * from the folded fallbacks — and once after it is released and the
 * first-screen hydration has replaced them.
 *
 * The three layouts differ only in where the boundaries sit, which is the
 * claim under test: the mechanism does not care about their number or their
 * position, because each is folded where it stands and the surrounding tree
 * positions it.
 */

/**
 * Hold the background thread by buffering the messages that start it: the RPC
 * hands over its `MessagePort` in the first one, so until it is delivered the
 * background thread has nothing to run and what is on screen is the main
 * thread's own frame.
 *
 * Only the background worker is held. Lynx for Web also runs a *decode*
 * worker, and holding that one stalls the template itself — neither thread
 * would run and the page would merely be blank for the wrong reason. The
 * background worker is the one created as `lynx-bg`.
 *
 * Buffering the arguments rather than the worker keeps `new Worker()`
 * synchronous, and nothing is transferred until the flush, so transferables
 * are still neutered exactly once.
 */
async function holdBackgroundThread(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const backgroundWorkers = new WeakSet<Worker>();
    const held: { target: Worker; args: unknown[] }[] = [];

    const OriginalWorker = globalThis.Worker;
    globalThis.Worker = class extends OriginalWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        if (options?.name === 'lynx-bg') {
          backgroundWorkers.add(this);
        }
      }
    } as typeof Worker;

    const originalPostMessage = OriginalWorker.prototype.postMessage;
    OriginalWorker.prototype.postMessage = function(
      this: Worker,
      ...args: unknown[]
    ) {
      if (backgroundWorkers.has(this)) {
        held.push({ target: this, args });
        return;
      }
      (originalPostMessage as (...a: unknown[]) => void).apply(this, args);
    } as typeof Worker.prototype.postMessage;

    (globalThis as unknown as { __releaseBackgroundThread: () => number })
      .__releaseBackgroundThread = () => {
        const pending = held.splice(0);
        for (const { target, args } of pending) {
          (originalPostMessage as (...a: unknown[]) => void).apply(
            target,
            args,
          );
        }
        for (const worker of pending) {
          backgroundWorkers.delete(worker.target);
        }
        return pending.length;
      };
  });
}

async function releaseBackgroundThread(page: Page): Promise<number> {
  return await page.evaluate(() =>
    (globalThis as unknown as { __releaseBackgroundThread: () => number })
      .__releaseBackgroundThread()
  );
}

async function gotoHeld(page: Page, casename: string): Promise<void> {
  await holdBackgroundThread(page);
  await page.goto(`/?casename=${casename}`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
}

const shot = async (page: Page, casename: string, label: string) => {
  await expect(page).toHaveScreenshot([casename, `${label}.png`], {
    fullPage: true,
    animations: 'disabled',
  });
};

test.describe('<Background> islands', () => {
  test('api-background-island-top', async ({ page }, { title }) => {
    await gotoHeld(page, title);

    // The main thread alone: the boundary is the render root, so the whole
    // first screen is the fallback — and it is a *component*, whose body ran
    // here to produce three rows.
    await expect(page.locator('#skeleton-top-0')).toBeVisible();
    await expect(page.locator('#skeleton-top-2')).toBeVisible();
    await expect(page.locator('#real-top')).toHaveCount(0);
    await shot(page, title, 'main-thread-fallback');

    expect(await releaseBackgroundThread(page)).toBeGreaterThan(0);

    // Hydration replaces the island with the deferred content.
    await expect(page.locator('#real-top')).toBeVisible();
    await expect(page.locator('#skeleton-top-0')).toHaveCount(0);
    await shot(page, title, 'hydrated');
  });

  test('api-background-island-middle', async ({ page }, { title }) => {
    await gotoHeld(page, title);

    // The boundary is inside a component that is itself first-screen content:
    // the header renders on the main thread, the island sits under it.
    await expect(page.locator('#header')).toBeVisible();
    await expect(page.locator('#skeleton-mid-0')).toBeVisible();
    await expect(page.locator('#real-mid')).toHaveCount(0);
    await shot(page, title, 'main-thread-fallback');

    await releaseBackgroundThread(page);

    await expect(page.locator('#real-mid')).toBeVisible();
    await expect(page.locator('#skeleton-mid-0')).toHaveCount(0);
    // The non-deferred header is untouched by the replacement.
    await expect(page.locator('#header')).toBeVisible();
    await shot(page, title, 'hydrated');
  });

  test('api-background-island-multi', async ({ page }, { title }) => {
    await gotoHeld(page, title);

    // Three islands with no tree relationship between them, each positioned
    // by whatever surrounds it.
    for (const label of ['a', 'b', 'c']) {
      await expect(page.locator(`#skeleton-${label}-0`)).toBeVisible();
      await expect(page.locator(`#real-${label}`)).toHaveCount(0);
    }
    await expect(page.locator('#header')).toBeVisible();
    await shot(page, title, 'main-thread-fallback');

    await releaseBackgroundThread(page);

    // One hydration pass replaces all three, independently.
    for (const label of ['a', 'b', 'c']) {
      await expect(page.locator(`#real-${label}`)).toBeVisible();
      await expect(page.locator(`#skeleton-${label}-0`)).toHaveCount(0);
    }
    await expect(page.locator('#header')).toBeVisible();
    await shot(page, title, 'hydrated');
  });
});
