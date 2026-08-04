// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from '@lynx-js/playwright-fixtures';
import type { Page } from '@playwright/test';

/**
 * The first-screen boundary matrix, end to end.
 *
 * Thirteen placements of `<Background>` and `<MainThread>` relative to each
 * other, each built twice — once with `enableMTSRendering: true` (the classic
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

const MODES = ['ifr', 'mts'] as const;
type Mode = typeof MODES[number];

const PHASES = ['main-thread', 'stamped', 'hydrated'] as const;
type Phase = typeof PHASES[number];

/** The colours the fixtures paint with, as the browser reports them. */
const COLOR = {
  skeleton: 'rgb(201, 213, 227)',
  deferred: 'rgb(46, 139, 87)',
  island: 'rgb(47, 111, 208)',
  header: 'rgb(26, 26, 46)',
  stamp: 'rgb(245, 166, 35)',
} as const;

/**
 * Hold the background thread by buffering the messages that start it: the RPC
 * hands over its `MessagePort` in the first one, so until it is delivered the
 * background thread has nothing to run and what is on screen is the main
 * thread's own frame. Only the `lynx-bg` worker is held — holding the decode
 * worker would stall the template itself.
 *
 * Installed once and idempotent. A page that runs this twice would wrap its
 * own wrapper: the second `Worker` subclass extends the first, and the second
 * release then flushes *into* the first hold, which is still armed and holds
 * everything again. That deadlock is invisible until a case navigates twice.
 */
async function holdBackgroundThread(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const installed = '__releaseBackgroundThread';
    if (installed in globalThis) {
      return;
    }
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

/** One identified element the page is showing. */
interface Shown {
  id: string;
  color: string;
}

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

/** One captured frame, for the side-by-side report. */
interface Frame {
  casename: string;
  mode: Mode;
  phase: Phase;
  shown: Shown[];
  /** The screenshot, base64 PNG — inlined so the report is one file. */
  png: string;
}

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
  'p13-bg-island-prop': {
    // The same thing through `<Background island={…}>`, which owns the
    // position so the author cannot put the two arms out of step. Same frame
    // as `p12`, from half the source.
    ifr: ['p13-island', 'p13-skeleton-0', 'p13-skeleton-1'],
    mts: ['p13-island', 'p13-skeleton-0', 'p13-skeleton-1'],
  },
};

const CASES = Object.keys(MODEL);

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
      renderReport(frames),
    );
  });
});

/** The side-by-side report: every case, both builds, all three phases. */
function renderReport(all: Frame[]): string {
  const escape = (text: string) =>
    text.replace(
      /[&<>]/g,
      (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char]!,
    );

  const cell = (casename: string, mode: Mode, phase: Phase): string => {
    const frame = all.find((f) =>
      f.casename === casename && f.mode === mode && f.phase === phase
    );
    if (!frame) {
      return `<td class="cell"><em>not captured</em></td>`;
    }
    const rows = frame.shown.length === 0
      ? '<li class="empty">— empty —</li>'
      : frame.shown
        .map(({ id, color }) =>
          `<li><span class="swatch" style="background:${
            escape(color)
          }"></span>${escape(id)}</li>`
        )
        .join('');
    return `<td class="cell">
      <img src="data:image/png;base64,${frame.png}" alt="${
      escape(`${casename} ${mode} ${phase}`)
    }" />
      <ul class="ids">${rows}</ul>
    </td>`;
  };

  const caseRows = CASES.map((casename) =>
    `<section>
      <h2>${escape(casename)}</h2>
      <table>
        <thead>
          <tr><th></th>${
      PHASES.map((phase) => `<th>${escape(phase)}</th>`).join('')
    }</tr>
        </thead>
        <tbody>
          ${
      MODES.map((mode) =>
        `<tr><th class="mode">${
          mode === 'ifr'
            ? 'enableMTSRendering: true'
            : 'enableMTSRendering: false'
        }</th>${
          PHASES.map((phase) => cell(casename, mode, phase)).join('')
        }</tr>`
      ).join('')
    }
        </tbody>
      </table>
    </section>`
  ).join('\n');

  return `<!doctype html>
<meta charset="utf-8">
<title>First-screen boundary matrix</title>
<style>
  body { font: 14px/1.5 system-ui, sans-serif; margin: 2rem; color: #1a1a2e; }
  h1 { font-size: 1.4rem; }
  section { margin: 2.5rem 0; }
  h2 { font-size: 1.1rem; font-family: ui-monospace, monospace; }
  table { border-collapse: collapse; }
  th, td { border: 1px solid #d8dee9; padding: .5rem; vertical-align: top; }
  th { background: #f4f6fa; font-weight: 600; text-align: left; }
  th.mode { font-family: ui-monospace, monospace; font-weight: 400; width: 14rem; }
  img { display: block; width: 200px; border: 1px solid #e6e9f0; }
  ul.ids { list-style: none; margin: .5rem 0 0; padding: 0;
           font-family: ui-monospace, monospace; font-size: 12px; }
  ul.ids li { display: flex; align-items: center; gap: .4rem; }
  li.empty { color: #8a94a6; font-style: italic; }
  .swatch { width: .8rem; height: .8rem; border: 1px solid #c3c9d4; }
  .legend { display: flex; gap: 1.2rem; flex-wrap: wrap; padding: 0; list-style: none; }
  .legend li { display: flex; align-items: center; gap: .4rem; }
</style>
<h1>First-screen boundary matrix</h1>
<p>
  Every case is built twice from identical source and observed three times:
  the frame the main thread built alone (the background thread is held), the
  same frame after every main-thread-built element has been tapped, and the
  frame after the background was released and handed over. A stamp that
  survives the hand-over means the element was <strong>adopted</strong>; a
  stamp that vanishes means it was <strong>replaced</strong>.
</p>
<ul class="legend">
  ${
    Object.entries(COLOR)
      .map(([name, value]) =>
        `<li><span class="swatch" style="background:${value}"></span>${name}</li>`
      )
      .join('')
  }
</ul>
${caseRows}
`;
}
