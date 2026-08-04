// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * The side-by-side report the boundary matrix writes.
 *
 * Kept out of the spec because it is a different job: the spec asserts, this
 * one presents. What it presents is the thing assertions cannot show — the
 * *frames*, next to each other, so a reader can see the main thread's own
 * screen, the same screen once every element it built has been tapped, and
 * what survived the hand-over.
 */

export type Mode = 'ifr' | 'mts';
export type Phase = 'main-thread' | 'stamped' | 'hydrated';

export const MODES: readonly Mode[] = ['ifr', 'mts'];
export const PHASES: readonly Phase[] = ['main-thread', 'stamped', 'hydrated'];

export const MODE_LABEL: Record<Mode, string> = {
  ifr: 'enableMTSRendering: true',
  mts: 'enableMTSRendering: false',
};

export const PHASE_LABEL: Record<Phase, string> = {
  'main-thread': 'main thread alone',
  'stamped': 'after tapping',
  'hydrated': 'after hand-over',
};

/** The colours the fixtures paint with, as the browser reports them. */
export const COLOR = {
  skeleton: 'rgb(201, 213, 227)',
  deferred: 'rgb(46, 139, 87)',
  island: 'rgb(47, 111, 208)',
  header: 'rgb(26, 26, 46)',
  stamp: 'rgb(245, 166, 35)',
} as const;

const COLOR_MEANING: Record<keyof typeof COLOR, string> = {
  island: 'island — the main thread built it',
  skeleton: 'fallback — a deferred region’s placeholder',
  deferred: 'deferred content — only the background renders it',
  header: 'ordinary content, outside every boundary',
  stamp: 'tapped by a main-thread worklet',
};

export interface Shown {
  id: string;
  color: string;
}

export interface Frame {
  casename: string;
  mode: Mode;
  phase: Phase;
  shown: Shown[];
  /** The screenshot, base64 PNG — inlined so the report is one file. */
  png: string;
}

/** What each case is built to ask. */
export const CASE_QUESTION: Record<string, string> = {
  'p01-plain':
    'No boundary at all. The two ends of the dial, from one source file.',
  'p02-bg-root': 'The whole app deferred: the first frame is the fallback.',
  'p03-mt-root': 'The whole app promoted: the first frame is the island.',
  'p04-bg-mid': 'A deferred region under first-screen content.',
  'p05-mt-mid': 'An island in the middle of the tree.',
  'p06-mt-in-bg':
    'A <MainThread> inside a deferred subtree — a position the main thread never walks to.',
  'p07-bg-in-mt': 'An island that defers part of itself.',
  'p08-bg-in-bg': 'Nested deferrals: the outer fallback wins.',
  'p09-mt-in-mt': 'A redundant nested island, which must be harmless.',
  'p10-siblings': 'Both boundaries side by side, with plain content between.',
  'p11-marked-in-bg':
    '`p06` with the ’main thread component’ marker: does compiling the module place it?',
  'p12-bg-shared-island':
    'The island named in both arms of the boundary, by hand.',
  'p13-bg-island-prop':
    'The same, through `<Background island={…}>`, which owns the position.',
};

const escape = (text: string): string =>
  text.replace(
    /[&<>"]/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]!,
  );

const isIsland = (id: string): boolean => id.endsWith('-island');
const isFallback = (id: string): boolean => /-skeleton-\d$/.test(id);

/** One case's verdict, read off the frames rather than restated by hand. */
interface Verdict {
  firstFrame: string;
  islandOnFirstFrame: boolean;
  adopted: boolean;
  switchChangesFirstFrame: boolean;
}

function verdictOf(all: Frame[], casename: string): Verdict {
  const at = (mode: Mode, phase: Phase): Shown[] =>
    all.find((f) =>
      f.casename === casename && f.mode === mode && f.phase === phase
    )?.shown ?? [];

  const ifrFirst = at('ifr', 'main-thread');
  const mtsFirst = at('mts', 'main-thread');
  const islandOnFirstFrame = mtsFirst.some(({ id }) => isIsland(id));
  const hydrated = at('mts', 'hydrated');

  const firstFrame = mtsFirst.length === 0
    ? 'nothing'
    : [
      islandOnFirstFrame ? 'island' : undefined,
      mtsFirst.some(({ id }) => isFallback(id)) ? 'fallback' : undefined,
      mtsFirst.some(({ id }) => id.endsWith('-header')) ? 'header' : undefined,
    ].filter(Boolean).join(' + ');

  return {
    firstFrame,
    islandOnFirstFrame,
    adopted: islandOnFirstFrame
      && hydrated.some(({ id, color }) =>
        isIsland(id) && color === COLOR.stamp
      ),
    switchChangesFirstFrame: ifrFirst.map(({ id }) => id).join()
      !== mtsFirst.map(({ id }) => id).join(),
  };
}

function chip(kind: 'yes' | 'no' | 'note', text: string): string {
  return `<span class="chip chip--${kind}">${escape(text)}</span>`;
}

function cell(
  all: Frame[],
  casename: string,
  mode: Mode,
  phase: Phase,
): string {
  const frame = all.find((f) =>
    f.casename === casename && f.mode === mode && f.phase === phase
  );
  if (!frame) {
    return '<td class="cell"><p class="missing">not captured</p></td>';
  }
  const rows = frame.shown.length === 0
    ? '<li class="empty">nothing on screen</li>'
    : frame.shown
      .map(({ id, color }) =>
        `<li><span class="swatch" style="background:${
          escape(color)
        }"></span><code>${escape(id)}</code></li>`
      )
      .join('');
  return `<td class="cell">
        <img src="data:image/png;base64,${frame.png}" width="264" height="176"
             alt="${
    escape(`${casename}, ${MODE_LABEL[mode]}, ${PHASE_LABEL[phase]}`)
  }" />
        <ul class="ids">${rows}</ul>
      </td>`;
}

function caseSection(all: Frame[], casename: string): string {
  const verdict = verdictOf(all, casename);
  const body = MODES.map((mode) =>
    `<tr>
          <th scope="row"><code>${escape(MODE_LABEL[mode])}</code></th>
          ${
      PHASES.map((phase) => cell(all, casename, mode, phase)).join(
        '\n          ',
      )
    }
        </tr>`
  ).join('\n        ');

  return `<section class="case" id="${escape(casename)}">
      <header class="case__head">
        <h3><code>${escape(casename)}</code></h3>
        <p class="case__question">${escape(CASE_QUESTION[casename] ?? '')}</p>
        <p class="case__chips">${
    [
      chip(
        verdict.islandOnFirstFrame ? 'yes' : 'no',
        verdict.islandOnFirstFrame
          ? 'island on the first frame'
          : 'no island on the first frame',
      ),
      verdict.islandOnFirstFrame
        ? chip(
          verdict.adopted ? 'yes' : 'no',
          verdict.adopted ? 'adopted' : 'replaced',
        )
        : '',
      verdict.switchChangesFirstFrame
        ? chip('note', 'the switch changes this frame')
        : '',
    ].filter(Boolean).join('')
  }</p>
      </header>
      <div class="scroller">
        <table class="frames">
          <thead>
            <tr><td></td>${
    PHASES.map((phase) => `<th scope="col">${escape(PHASE_LABEL[phase])}</th>`)
      .join('')
  }</tr>
          </thead>
          <tbody>
        ${body}
          </tbody>
        </table>
      </div>
    </section>`;
}

function summary(all: Frame[], cases: readonly string[]): string {
  const rows = cases.map((casename) => {
    const v = verdictOf(all, casename);
    return `<tr>
          <th scope="row"><a href="#${escape(casename)}"><code>${
      escape(casename)
    }</code></a></th>
          <td>${escape(v.firstFrame)}</td>
          <td>${
      v.islandOnFirstFrame
        ? chip(v.adopted ? 'yes' : 'no', v.adopted ? 'adopted' : 'replaced')
        : '<span class="dash">—</span>'
    }</td>
          <td>${
      v.switchChangesFirstFrame
        ? chip('note', 'differs')
        : '<span class="dash">same</span>'
    }</td>
        </tr>`;
  }).join('\n        ');

  return `<div class="scroller">
      <table class="summary">
        <caption>Every case, read off the frames below.</caption>
        <thead>
          <tr>
            <th scope="col">case</th>
            <th scope="col">what the main thread built</th>
            <th scope="col">island after hand-over</th>
            <th scope="col">the two builds</th>
          </tr>
        </thead>
        <tbody>
        ${rows}
        </tbody>
      </table>
    </div>`;
}

/** The whole report, as one self-contained page. */
export function renderReport(
  all: Frame[],
  cases: readonly string[],
): string {
  const legend = (Object.keys(COLOR) as (keyof typeof COLOR)[])
    .map((name) =>
      `<li><span class="swatch" style="background:${COLOR[name]}"></span>
        <b>${escape(name)}</b> ${escape(COLOR_MEANING[name])}</li>`
    )
    .join('\n      ');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>First-screen boundary matrix</title>
<style>
  :root {
    color-scheme: light dark;
    /* The palette is the fixtures' own, so the legend and the screenshots
       speak one language. */
    --island: #2f6fd0;
    --deferred: #2e8b57;
    --stamp: #f5a623;
    --skeleton: #c9d5e3;

    --ink: #15171f;
    --ink-soft: #4a5164;
    --ink-mute: #6a7183;
    --ground: #f5f6f9;
    --surface: #ffffff;
    --rule: #dde1e9;
    --rule-soft: #e9ecf2;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --island: #6ea3f0;
      --deferred: #55b184;
      --stamp: #f6b34a;
      --skeleton: #8996a8;
      --ink: #e7eaf1;
      --ink-soft: #b3bccd;
      --ink-mute: #8a93a6;
      --ground: #0f1118;
      --surface: #171a23;
      --rule: #2b3140;
      --rule-soft: #232836;
    }
  }
  :root[data-theme="dark"] {
    --island: #6ea3f0; --deferred: #55b184; --stamp: #f6b34a; --skeleton: #8996a8;
    --ink: #e7eaf1; --ink-soft: #b3bccd; --ink-mute: #8a93a6;
    --ground: #0f1118; --surface: #171a23; --rule: #2b3140; --rule-soft: #232836;
  }
  :root[data-theme="light"] {
    --island: #2f6fd0; --deferred: #2e8b57; --stamp: #f5a623; --skeleton: #c9d5e3;
    --ink: #15171f; --ink-soft: #4a5164; --ink-mute: #6a7183;
    --ground: #f5f6f9; --surface: #ffffff; --rule: #dde1e9; --rule-soft: #e9ecf2;
  }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: clamp(1.5rem, 4vw, 3.5rem) clamp(1rem, 4vw, 3rem) 5rem;
    background: var(--ground);
    color: var(--ink);
    font: 15px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    font-variant-numeric: tabular-nums;
  }
  code, .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }

  .wrap { max-width: 62rem; margin: 0 auto; display: flex; flex-direction: column; gap: 2.75rem; }

  .lede { display: flex; flex-direction: column; gap: .85rem; }
  .eyebrow {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px; letter-spacing: .14em; text-transform: uppercase;
    color: var(--island); margin: 0;
  }
  h1 {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: clamp(1.6rem, 3.6vw, 2.3rem); font-weight: 600;
    letter-spacing: -.02em; text-wrap: balance; margin: 0;
  }
  .lede p { margin: 0; max-width: 62ch; color: var(--ink-soft); }

  h2 {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 1rem; font-weight: 600; letter-spacing: .01em;
    margin: 0 0 .9rem; padding-bottom: .5rem; border-bottom: 1px solid var(--rule);
  }

  .key { display: grid; gap: 1.25rem; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); }
  .key ol, .key ul { margin: 0; padding-left: 1.1rem; display: flex; flex-direction: column; gap: .45rem; }
  .key ul { list-style: none; padding-left: 0; }
  .key li { color: var(--ink-soft); }
  .key b { color: var(--ink); font-weight: 600; }

  .swatch {
    display: inline-block; width: .78rem; height: .78rem; margin-right: .45rem;
    border: 1px solid rgb(0 0 0 / .18); vertical-align: -1px; flex: none;
  }

  .scroller { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; }
  caption { text-align: left; color: var(--ink-mute); padding-bottom: .55rem; font-size: 13px; }
  th, td { text-align: left; vertical-align: top; padding: .55rem .7rem; }
  thead th { font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-mute); font-weight: 600; }

  .summary { background: var(--surface); border: 1px solid var(--rule); }
  .summary tbody tr + tr { border-top: 1px solid var(--rule-soft); }
  .summary th[scope="row"] { font-weight: 400; white-space: nowrap; }
  .summary a { color: var(--island); text-decoration: none; }
  .summary a:hover, .summary a:focus-visible { text-decoration: underline; }
  .dash { color: var(--ink-mute); }

  .chip {
    display: inline-block; margin-right: .35rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11.5px; letter-spacing: .02em;
    padding: .12rem .45rem; border: 1px solid; white-space: nowrap;
  }
  .chip--yes { color: var(--deferred); border-color: color-mix(in srgb, var(--deferred) 45%, transparent); }
  .chip--no { color: var(--ink-mute); border-color: var(--rule); }
  .chip--note { color: var(--stamp); border-color: color-mix(in srgb, var(--stamp) 55%, transparent); }

  .case { background: var(--surface); border: 1px solid var(--rule); }
  .case__head { display: flex; flex-direction: column; gap: .3rem; padding: 1rem 1rem .85rem; border-bottom: 1px solid var(--rule-soft); }
  .case__head h3 { margin: 0; font-size: 1rem; font-weight: 600; }
  .case__question { margin: 0; color: var(--ink-soft); max-width: 68ch; }
  .case__chips { margin: .25rem 0 0; }

  .frames { min-width: 44rem; }
  .frames thead th { padding-top: .8rem; }
  .frames tbody th { font-weight: 400; white-space: nowrap; color: var(--ink-soft); width: 1%; }
  .frames tbody tr + tr td, .frames tbody tr + tr th { border-top: 1px solid var(--rule-soft); }
  .cell img {
    display: block; width: 264px; height: 176px; max-width: 100%;
    border: 1px solid var(--rule); background: #fff;
  }
  ul.ids { list-style: none; margin: .5rem 0 0; padding: 0; display: flex; flex-direction: column; gap: .18rem; font-size: 12px; }
  ul.ids li { display: flex; align-items: center; }
  li.empty, .missing { color: var(--ink-mute); font-style: italic; font-size: 12px; }

  a:focus-visible { outline: 2px solid var(--island); outline-offset: 2px; }
</style>
</head>
<body>
<div class="wrap">
  <header class="lede">
    <p class="eyebrow">ReactLynx · first-screen boundaries</p>
    <h1>What the main thread built, and what survived the hand-over</h1>
    <p>
      ${cases.length} placements of <code>&lt;Background&gt;</code> and
      <code>&lt;MainThread&gt;</code>, each built twice from identical source —
      once with the classic dual-thread build, once with the assembled
      main-thread bundle — and each build observed three times.
      ${all.length} frames in all.
    </p>
  </header>

  <section>
    <h2>How to read a row</h2>
    <div class="key">
      <ol>
        <li>The background thread is held, so the screen is the main thread’s own frame.</li>
        <li>Still held, every element on it is tapped. The handler is a main-thread worklet that paints the element orange — so a stamp is proof the main thread is running that element’s code with no background thread in existence.</li>
        <li>The background is released and hands over. A stamp that is still there means the element was <b>adopted</b>; a stamp that is gone means it was <b>replaced</b>.</li>
      </ol>
      <ul>
        ${legend}
      </ul>
    </div>
  </section>

  <section>
    <h2>Results</h2>
    ${summary(all, cases)}
  </section>

  ${cases.map((casename) => caseSection(all, casename)).join('\n  ')}
</div>
</body>
</html>
`;
}
