// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { test } from '@lynx-js/playwright-fixtures';
import type { Page } from '@playwright/test';

/**
 * Captures the `<Background>` matrix rather than asserting on it.
 *
 * Every case is rendered twice — once with the background thread held, which
 * is the main thread's own frame (MTR), and once after release, which is what
 * the background thread produced (BTR) — and both are written out with the
 * DOM they came from. `bgmatrix.report.mjs` turns the result into a
 * side-by-side page.
 *
 * Nothing here fails on an unexpected result: the point is to record what
 * every permutation actually does, including the ones that do not work.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MATRIX_DIR = path.join(__dirname, 'bgmatrix');
const OUT_DIR = path.join(__dirname, '..', 'bgmatrix-report');

const cases = JSON.parse(
  fs.readFileSync(path.join(MATRIX_DIR, 'cases.json'), 'utf8'),
) as Record<
  string,
  { what: string; expectBuildError: boolean; files: string[] }
>;

const VARIANTS = [
  { suffix: 'auto', label: `enableMTSRendering: 'auto' (default)` },
  { suffix: 'off', label: 'enableMTSRendering: false' },
  { suffix: 'on', label: 'enableMTSRendering: true' },
];

/** See `background-island.spec.ts` — only the `lynx-bg` worker is held. */
async function holdBackgroundThread(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const backgroundWorkers = new WeakSet<Worker>();
    const held: { target: Worker; args: unknown[] }[] = [];

    const OriginalWorker = globalThis.Worker;
    globalThis.Worker = class extends OriginalWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        if (options?.name === 'lynx-bg') backgroundWorkers.add(this);
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

    (globalThis as unknown as { __release: () => number }).__release = () => {
      const pending = held.splice(0);
      for (const { target, args } of pending) {
        (originalPostMessage as (...a: unknown[]) => void).apply(target, args);
      }
      return pending.length;
    };
  });
}

/**
 * Shoot the `lynx-view` itself rather than the page: the report puts two of
 * these next to each other, and the browser chrome around them carries no
 * information.
 */
async function shoot(page: Page, file: string): Promise<void> {
  const view = page.locator('lynx-view');
  if (await view.count() > 0) {
    await view.first().screenshot({ path: file });
    return;
  }
  await page.screenshot({ path: file });
}

interface Frame {
  ids: string[];
  html: string;
}

async function readFrame(page: Page): Promise<Frame> {
  return await page.evaluate(() => {
    const view = document.querySelector('lynx-view');
    const shadow = (view as unknown as { shadowRoot?: ShadowRoot } | null)
      ?.shadowRoot;
    const page_ = shadow?.querySelector('[part="page"]');
    return {
      ids: [...(shadow?.querySelectorAll('[id]') ?? [])].map((e) => e.id)
        .filter((id) =>
          id.startsWith('sk-') || id.startsWith('real-')
          || id === 'hdr'
        ),
      html: page_?.innerHTML ?? '',
    };
  });
}

test.describe('background matrix', () => {
  for (const [name, def] of Object.entries(cases)) {
    for (const { suffix } of VARIANTS) {
      const entry = `bg-${name}--${suffix}`;
      test(entry, async ({ page }) => {
        const outDir = path.join(OUT_DIR, entry);
        fs.mkdirSync(outDir, { recursive: true });

        const bundle = path.join(
          __dirname,
          '..',
          'dist',
          `${entry}.web.bundle`,
        );
        if (!fs.existsSync(bundle)) {
          // The build refused this permutation; that *is* its result. Still
          // navigate, so the shared coverage fixture has a page to attach to.
          await page.goto('/?casename=__none__', { waitUntil: 'load' });
          fs.writeFileSync(
            path.join(outDir, 'result.json'),
            JSON.stringify({ entry, name, suffix, status: 'build-error' }),
          );
          return;
        }

        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await holdBackgroundThread(page);
        await page.goto(`/?casename=${entry}`, { waitUntil: 'load' });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(700);

        const mtr = await readFrame(page);
        await shoot(page, path.join(outDir, 'mtr.png'));

        const released = await page.evaluate(() =>
          (globalThis as unknown as { __release: () => number }).__release()
        );
        await page.waitForTimeout(900);

        const btr = await readFrame(page);
        await shoot(page, path.join(outDir, 'btr.png'));

        // What the main-thread chunk kept, read straight from the artifact.
        const source = fs.readFileSync(bundle, 'utf8');
        fs.writeFileSync(
          path.join(outDir, 'result.json'),
          JSON.stringify(
            {
              entry,
              name,
              suffix,
              status: 'built',
              released,
              errors,
              mtr,
              btr,
              bundle: {
                assembled: source.includes(
                  '__REACT_LYNX_MTS_DEFINES_RUNTIME__',
                ),
                deferredLogicPresent: source.includes('REAL-LOGIC'),
                fallbackLogicPresent: source.includes('SK-LOGIC'),
              },
            },
            null,
            2,
          ),
        );
      });
    }
  }
});
