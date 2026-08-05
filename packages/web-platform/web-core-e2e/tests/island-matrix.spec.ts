// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from '@lynx-js/playwright-fixtures';
import type { Page } from '@playwright/test';

import {
  holdBackgroundThread,
  releaseBackgroundThread,
} from './holdBackgroundThread.js';
import {
  COLOR,
  type Sources,
  type Frame,
  type Mode,
  MODES,
  type Phase,
  type Shown,
  renderReport,
} from './island-matrix-report.js';

/**
 * The first-screen boundary matrix, end to end.
 *
 * Thirteen placements of `<Background>` and `<MainThread>` relative to each
 * other, each built twice — once with `experimental_enableMTSRendering: true` (the classic
 * dual-thread build) and once with `false` (the assembled main-thread bundle)
 * — from *identical source*. Each build is observed three times:
 *
 * - `main-thread` — the background thread is held, so what is on screen is
 *   exactly what the main thread alone built.
 * - `stamped` — still held, every element the main thread claims to have
 *   built has been tapped. The handler is a main-thread worklet that paints
 *   the element orange, so a stamp is proof the main thread is running code
 *   for that element with no background thread in existence.
 * - `hydrated` — the background has been released and has handed over. A
 *   stamp that is still there means the background *adopted* that element;
 *   a stamp that is gone means it replaced it. That is the D3 question, read
 *   straight off a screenshot.
 *
 * Three claims are under test:
 *
 * 1. The hydrated page does not depend on the switch.
 * 2. The main thread's own frame is what the model predicts, per case.
 * 3. Islands are adopted; fallbacks are replaced.
 */

/**
 * The identified elements on screen, in document order, with the colour each
 * is actually painted. Lynx for Web renders inside `lynx-view`'s shadow root,
 * so this has to walk shadow roots explicitly — `document.querySelectorAll`
 * alone reports an empty page for every case.
 *
 * The hydration beacon is filtered out: it is a signal to wait on, not
 * content to compare.
 */
async function shown(page: Page): Promise<Shown[]> {
  return await page.evaluate(() => {
    const found: { id: string; color: string }[] = [];
    const walk = (root: ParentNode): void => {
      for (const element of root.querySelectorAll('*')) {
        if (element.id) {
          found.push({
            id: element.id,
            color: getComputedStyle(element).backgroundColor,
          });
        }
        if (element.shadowRoot) {
          walk(element.shadowRoot);
        }
      }
    };
    walk(document);
    return found.filter(({ id }) =>
      /^p\d\d/.test(id) && !id.endsWith('-bt-ready')
    );
  });
}

const ids = (list: Shown[]): string[] => list.map(({ id }) => id);

const REPORT_DIR = path.join(
  import.meta.dirname,
  '..',
  'island-matrix-report',
);

const frames: Frame[] = [];

async function capture(
  page: Page,
  casename: string,
  mode: Mode,
  phase: Phase,
): Promise<Shown[]> {
  const list = await shown(page);
  const png = await page.screenshot({
    // A fixed window over the top-left, not the full page: every fixture
    // draws inside it, and holding the frame constant is what makes the
    // report's six images comparable at a glance — an empty frame reads as
    // empty rather than as a differently-sized picture.
    clip: { x: 0, y: 0, width: 264, height: 176 },
    animations: 'disabled',
  });
  frames.push({
    casename,
    mode,
    phase,
    shown: list,
    png: png.toString('base64'),
  });
  return list;
}

/**
 * Everything the main thread claims to have built, tapped. Only elements with
 * a main-thread handler respond, which is exactly the set we want to
 * interrogate: islands and component fallbacks.
 */
async function stampAll(page: Page, list: Shown[]): Promise<void> {
  for (const { id } of list) {
    if (!id.endsWith('-island') && !/-skeleton-\d$/.test(id)) {
      continue;
    }
    await page.locator(`#${id}`).click();
  }
}

interface Observation {
  mainThread: Shown[];
  stamped: Shown[];
  hydrated: Shown[];
}

async function runCase(
  page: Page,
  casename: string,
  mode: Mode,
): Promise<Observation> {
  const tag = casename.slice(0, 3);

  await page.goto(`/?casename=island-${casename}-${mode}`, {
    waitUntil: 'load',
  });
  await page.evaluate(() => document.fonts.ready);

  // The main thread's frame is whatever is there once the template has been
  // decoded and run; the background cannot have contributed, it is held.
  // Settle on it rather than guessing: a case whose first frame is empty by
  // design has nothing to wait for, so the wait is allowed to run out.
  await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll('lynx-view')].some((view) =>
          (view.shadowRoot?.querySelectorAll('[id]').length ?? 0) > 0
        ),
      undefined,
      { timeout: 2000 },
    )
    .catch(() => undefined);
  await page.waitForTimeout(200);
  const mainThread = await capture(page, casename, mode, 'main-thread');

  await stampAll(page, mainThread);
  const stamped = await capture(page, casename, mode, 'stamped');

  expect(await releaseBackgroundThread(page)).toBeGreaterThan(0);

  // The beacon renders from an effect, and effects only run on the background
  // thread — so it appears exactly once the background has rendered and the
  // first-screen hand-over is done. Every case has one, including the ones
  // whose two frames are otherwise identical.
  await page.locator(`#${tag}-bt-ready`).waitFor({ state: 'attached' });
  await page.waitForTimeout(200);
  const hydrated = await capture(page, casename, mode, 'hydrated');

  return { mainThread, stamped, hydrated };
}

/**
 * What the main thread is expected to build, per case. This is the model the
 * matrix exists to check, written down rather than inferred from the run.
 *
 * `ifr` is the classic build: no fold, so `<Background>` is an ordinary
 * component that renders its fallback here and `<MainThread>` is transparent.
 * `mts` is the assembled bundle: the fold rewrites each `<Background>` to its
 * fallback at compile time, and an entry that declares no boundary at all
 * brings no first frame with it.
 */
const MODEL: Record<string, Record<Mode, string[]>> = {
  'p01-plain': {
    // No boundary: the classic build renders the whole app here…
    ifr: ['p01-header', 'p01-island'],
    // …and the assembled one has nothing to render, by construction.
    mts: [],
  },
  'p02-bg-root': {
    ifr: ['p02-skeleton-0', 'p02-skeleton-1'],
    mts: ['p02-skeleton-0', 'p02-skeleton-1'],
  },
  'p03-mt-root': {
    ifr: ['p03-island'],
    mts: ['p03-island'],
  },
  'p04-bg-mid': {
    ifr: ['p04-header', 'p04-skeleton-0', 'p04-skeleton-1'],
    mts: ['p04-header', 'p04-skeleton-0', 'p04-skeleton-1'],
  },
  'p05-mt-mid': {
    ifr: ['p05-header', 'p05-island'],
    mts: ['p05-header', 'p05-island'],
  },
  'p06-mt-in-bg': {
    // The island is inside the deferred subtree. Neither build reaches it:
    // the classic one because the `<Background>` component renders its
    // fallback instead of its children, the assembled one because the fold
    // removed the children outright.
    ifr: ['p06-skeleton-0', 'p06-skeleton-1'],
    mts: ['p06-skeleton-0', 'p06-skeleton-1'],
  },
  'p07-bg-in-mt': {
    ifr: ['p07-island', 'p07-skeleton-0', 'p07-skeleton-1'],
    mts: ['p07-island', 'p07-skeleton-0', 'p07-skeleton-1'],
  },
  'p08-bg-in-bg': {
    ifr: ['p08-outer-skeleton-0', 'p08-outer-skeleton-1'],
    mts: ['p08-outer-skeleton-0', 'p08-outer-skeleton-1'],
  },
  'p09-mt-in-mt': {
    ifr: ['p09-header', 'p09-island'],
    mts: ['p09-header', 'p09-island'],
  },
  'p10-siblings': {
    ifr: ['p10-island', 'p10-header', 'p10-skeleton-0', 'p10-skeleton-1'],
    mts: ['p10-island', 'p10-header', 'p10-skeleton-0', 'p10-skeleton-1'],
  },
  'p11-marked-in-bg': {
    // The marker compiles the island's module for the main thread. It does
    // not place it: nothing on the first-frame render path references it, so
    // the frame is the same as `p06`. Compilation and position are separate
    // problems, and this case is what says so.
    ifr: ['p11-skeleton-0', 'p11-skeleton-1'],
    mts: ['p11-skeleton-0', 'p11-skeleton-1'],
  },
  'p12-bg-shared-island': {
    // The island is named in both arms of the boundary, at the same position.
    // The main thread renders the fallback arm and builds it.
    ifr: ['p12-island', 'p12-skeleton-0', 'p12-skeleton-1'],
    mts: ['p12-island', 'p12-skeleton-0', 'p12-skeleton-1'],
  },
  'p14-bg-equal-arms': {
    // `p03` with no `<MainThread>` in sight: a `<Background>` whose two arms
    // are the same tree. If it produces `p03`'s frames, then `<MainThread>`
    // is not a second mechanism — it is the name of this degenerate case.
    ifr: ['p14-island'],
    mts: ['p14-island'],
  },
  'p13-bg-island-prop': {
    // The same thing through `<Background island={…}>`, which owns the
    // position so the author cannot put the two arms out of step. Same frame
    // as `p12`, from half the source.
    ifr: ['p13-island', 'p13-skeleton-0', 'p13-skeleton-1'],
    mts: ['p13-island', 'p13-skeleton-0', 'p13-skeleton-1'],
  },
};

const CASES = Object.keys(MODEL);

const FIXTURE_DIR = path.join(
  import.meta.dirname,
  'reactlynx',
  'island-matrix',
);

/** The shared module every case is built from, shown once in the report. */
const SHARED = 'parts.jsx';

/**
 * The source behind each case: its entry, plus any sibling module *only that
 * case* uses. `p06` and `p11` are the reason this follows imports at all —
 * what distinguishes them lives in a helper, not in the entry, and a report
 * that showed only entries would hide the very thing they are built to show.
 *
 * `parts.jsx` is excluded here and shown once at the top: thirteen copies of
 * the same file is noise, not evidence.
 */
async function collectSources(): Promise<Sources> {
  const read = async (file: string) => ({
    file,
    code: await fs.readFile(path.join(FIXTURE_DIR, file), 'utf8'),
  });

  const sources: Sources = { __shared__: [await read(SHARED)] };

  for (const casename of CASES) {
    const entry = path.posix.join(casename, 'index.jsx');
    const files = [await read(entry)];

    for (
      const [, specifier] of files[0]!.code.matchAll(
        /from\s*['"]\.\.?\/([^'"]+)['"]/g,
      )
    ) {
      if (
        specifier === undefined || specifier === SHARED
        || files.some((f) => f.file === specifier)
      ) {
        continue;
      }
      try {
        files.push(await read(specifier));
      } catch {
        // Not a sibling of the fixture directory; nothing to show.
      }
    }

    sources[casename] = files;
  }

  return sources;
}

test.describe('first-screen boundary matrix', () => {
  for (const casename of CASES) {
    test(casename, async ({ page }) => {
      await holdBackgroundThread(page);

      const observed = {} as Record<Mode, Observation>;
      for (const mode of MODES) {
        observed[mode] = await runCase(page, casename, mode);
      }

      for (const mode of MODES) {
        // Claim 2: the main thread's own frame is what the model predicts.
        expect(
          ids(observed[mode].mainThread),
          `${casename} (${mode}): main-thread frame`,
        ).toEqual(MODEL[casename]![mode]);

        // Everything the main thread built responds to a main-thread tap
        // with no background thread in existence.
        for (const { id, color } of observed[mode].stamped) {
          if (id.endsWith('-island') || /-skeleton-\d$/.test(id)) {
            expect(color, `${casename} (${mode}): ${id} is interactive`)
              .toBe(COLOR.stamp);
          }
        }
      }

      // Claim 1: the switch is invisible once the background has hydrated.
      expect(
        ids(observed.mts.hydrated),
        `${casename}: the hydrated page must not depend on the switch`,
      ).toEqual(ids(observed.ifr.hydrated));

      // Claim 3: an island the main thread built is *adopted* — its stamp
      // survives — while a fallback is replaced, so nothing of it survives.
      for (const mode of MODES) {
        const builtHere = new Set(ids(observed[mode].mainThread));
        for (const { id, color } of observed[mode].hydrated) {
          if (id.endsWith('-island') && builtHere.has(id)) {
            expect(color, `${casename} (${mode}): ${id} adopted, not replaced`)
              .toBe(COLOR.stamp);
          }
          if (id.endsWith('-deferred')) {
            expect(color, `${casename} (${mode}): ${id} is background content`)
              .toBe(COLOR.deferred);
          }
        }
        // A fallback the background replaced is gone, stamp and all.
        expect(
          ids(observed[mode].hydrated).filter((id) => /-skeleton-\d$/.test(id)),
          `${casename} (${mode}): fallbacks are replaced`,
        ).toEqual([]);
      }
    });
  }

  test.afterAll(async () => {
    await fs.mkdir(REPORT_DIR, { recursive: true });
    await fs.writeFile(
      path.join(REPORT_DIR, 'frames.json'),
      JSON.stringify(
        {
          colors: COLOR,
          model: MODEL,
          // The images live in the HTML; the JSON is for reading and diffing.
          frames: frames.map(({ png: _png, ...frame }) => frame),
        },
        null,
        2,
      ),
    );
    await fs.writeFile(
      path.join(REPORT_DIR, 'index.html'),
      renderReport(frames, CASES, await collectSources()),
    );
  });
});
