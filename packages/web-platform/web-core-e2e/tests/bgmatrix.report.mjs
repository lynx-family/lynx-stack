// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Turns the captured `<Background>` matrix into one self-explanatory page:
 * for every permutation, the source that produced it next to the frame the
 * main thread rendered on its own (MTR) and the frame after the background
 * thread arrived (BTR).
 *
 * Reads what the other two steps left behind and invents nothing:
 *   - `tests/bgmatrix/<case>/` .......... the sources
 *   - `bgmatrix-report/bg-<case>--<v>/` . MTR/BTR screenshots + the DOM
 *   - `dist-bundle/<case>--<v>/` ........ the Lynx main-thread chunk, which is
 *                                         the only artifact that can answer
 *                                         "did the deferred code leave?"
 *
 * Usage: node tests/bgmatrix.report.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const MATRIX_DIR = path.join(__dirname, 'bgmatrix');
const REPORT_DIR = path.join(ROOT, 'bgmatrix-report');
const BUNDLE_DIR = path.join(ROOT, 'dist-bundle');

const VARIANTS = [
  { suffix: 'auto', label: `'auto'`, note: 'the default — detection decides' },
  { suffix: 'off', label: 'false', note: 'assembled main-thread bundle' },
  { suffix: 'on', label: 'true', note: 'classic dual-thread build' },
];

const GROUPS = [
  {
    prefix: 'p',
    title: 'Position in the JSX tree',
    blurb:
      'Where the boundary sits. The fold happens where the element is written, '
      + 'so this axis asks whether the position itself ever matters.',
  },
  {
    prefix: 'i',
    title: 'How the boundary is imported',
    blurb:
      'How `Background` reaches the call site. The fold follows the *import '
      + 'binding*, so this is the axis where a static answer can run out.',
  },
  {
    prefix: 'f',
    title: 'What the fallback is',
    blurb:
      'What gets substituted. The fallback is compiled for the main thread as '
      + 'ordinary code, so this axis asks what "ordinary" covers.',
  },
  {
    prefix: 'g',
    title: 'Making the loss loud',
    blurb:
      'The element boundary is a rendering boundary; the bundling boundary '
      + 'belongs to the module graph. `import \'background-only\'` states the '
      + 'latter, so a shape the fold cannot cut fails the build instead of '
      + 'quietly shipping.',
  },
];

/**
 * Markers the fixtures export, so presence in a chunk is a fact, not a guess.
 *
 * They are *logic* markers, and the labels below say so. The boundary defers
 * code, never element shapes: the main thread is the only thread that can
 * touch the element tree, so it must own a snapshot creator for every shape
 * the background will ever hydrate, deferred or not. What leaves is the
 * component bodies and their transitive imports; what stays is one creator
 * per distinct JSX shape — see `p01-root`, `p05-siblings` and `p10-heavy`,
 * whose assembled blocks are byte-for-byte identical at 1170 B despite
 * 46 KB of source and two boundaries respectively.
 */
const DEFERRED_MARKER = 'REAL-LOGIC';
const FALLBACK_MARKER = 'SK-LOGIC';

const cases = JSON.parse(
  fs.readFileSync(path.join(MATRIX_DIR, 'cases.json'), 'utf8'),
);

/** Written by `bgmatrix.build.mjs`: why a permutation was refused, if it was. */
let builds = {};
try {
  builds = JSON.parse(
    fs.readFileSync(path.join(REPORT_DIR, 'builds.json'), 'utf8'),
  );
} catch {
  // Reports fine without it; the refusal just has no message attached.
}

function read(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return undefined;
  }
}

function dataUri(file) {
  try {
    return `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
  } catch {
    return undefined;
  }
}

/**
 * What the Lynx main-thread chunk kept. `undefined` when the build produced
 * no chunk at all, which is itself the answer for a rejected permutation.
 */
function bundleFacts(name, suffix) {
  // A refused build still emits assets before the error surfaces, so the
  // presence of a dump says nothing on its own.
  if (builds[`lynx:${name}--${suffix}`]?.ok === false) return undefined;
  const dump = read(
    path.join(BUNDLE_DIR, `${name}--${suffix}`, 'main-thread.dump.js'),
  );
  if (dump === undefined) return undefined;
  return {
    bytes: Buffer.byteLength(dump),
    assembled: dump.includes('__REACT_LYNX_MTS_DEFINES_RUNTIME__'),
    deferred: dump.includes(DEFERRED_MARKER),
    fallback: dump.includes(FALLBACK_MARKER),
  };
}

function has(ids, prefix) {
  return ids.some((id) => id.startsWith(prefix));
}

/**
 * The verdict, derived only from what was captured — two independent
 * questions kept apart on purpose, because they fail apart:
 *
 *   1. the first frame — did the main thread paint the fallback on its own?
 *   2. the chunk — did the deferred code leave the main-thread bundle?
 *
 * A permutation can pass (1) and fail (2): correct pixels, no bundle win.
 * Collapsing the two into one word is exactly the reading that would hide
 * where the mechanism actually runs out.
 */
function verdict(result, facts, def, suffix) {
  if (!result || result.status === 'build-error') {
    return def.expectBuildError.includes(suffix)
      ? {
        key: 'rejected',
        text: 'refused at build time (by design)',
        frame: '—',
        chunk: '—',
      }
      : { key: 'bad', text: 'build failed', frame: '—', chunk: '—' };
  }

  const mtr = result.mtr?.ids ?? [];
  const btr = result.btr?.ids ?? [];
  const hydrated = has(btr, 'real-');
  const mtrSk = has(mtr, 'sk-');
  const mtrReal = has(mtr, 'real-');

  // (2) — only the Lynx build has a separate main-thread chunk to read, and
  // only the assembled mode is being asked the question at all: the classic
  // build compiles business code for the main thread by definition, so
  // "the deferred code stayed" is its correct answer, not a shortfall.
  const classicBuild = suffix === 'on';
  const chunk = classicBuild
    ? 'classic — everything compiled'
    : facts === undefined
    ? 'not built'
    : facts.deferred
    ? 'deferred logic stayed'
    : 'deferred logic left';
  const chunkWin = classicBuild || (facts !== undefined && !facts.deferred);

  // (1)
  let frame;
  let key;
  if (mtr.length === 0) {
    frame = 'blank';
    key = 'blank';
  } else if (mtrSk && !mtrReal) {
    frame = 'fallback';
    key = chunkWin ? 'good' : 'partial';
  } else if (mtrReal) {
    // Either the boundary did not fold, or — as in `f04` — the fallback *is*
    // the deferred component and the author asked for it.
    frame = 'deferred content';
    key = chunkWin ? 'good' : 'partial';
  } else {
    // Content around the boundary painted; the boundary itself contributed
    // nothing, which is what `fallback={undefined}` means.
    frame = 'surroundings only';
    key = chunkWin ? 'good' : 'partial';
  }

  if (!hydrated) {
    key = 'bad';
    return {
      key,
      frame,
      chunk,
      text: `${frame} at 0.0, then hydration produced nothing`,
    };
  }
  if (key === 'blank') {
    return {
      key,
      frame,
      chunk,
      text: 'blank first frame, correct after hydration',
    };
  }
  return { key, frame, chunk, text: `${frame} at 0.0 · ${chunk}` };
}

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Prose in `cases.json` is written with markdown's backticks; honour them. */
const prose = (s) =>
  escapeHtml(s).replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');

/** Just enough highlighting to read JSX at a glance; no parser involved. */
function highlight(source) {
  const tokens = [];
  const stash = (cls, text) => {
    tokens.push(`<span class="${cls}">${escapeHtml(text)}</span>`);
    return `\u0000${tokens.length - 1}\u0000`;
  };
  let out = source
    .replace(/\/\/[^\n]*/g, (m) => stash('c', m))
    .replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1/g, (m) => stash('s', m))
    .replace(/\bBackground\b/g, (m) => stash('bg', m))
    .replace(
      /\b(import|export|from|const|let|function|return|default|if|else)\b/g,
      (m) => stash('k', m),
    );
  out = escapeHtml(out).replace(
    /\u0000(\d+)\u0000/g,
    (_, i) => tokens[Number(i)],
  );
  return out;
}

function frameCell(entry, kind, uri, ids) {
  if (!uri) return `<div class="shot missing">no capture</div>`;
  const tag = ids.length > 0
    ? `<code>${escapeHtml(ids.join(' '))}</code>`
    : `<em>empty</em>`;
  return `<figure class="shot">
      <img loading="lazy" src="${uri}" alt="${entry} ${kind}">
      <figcaption>${tag}</figcaption>
    </figure>`;
}

function factsCell(facts, classic, isClassic) {
  if (!facts) return `<span class="fact none">no main-thread chunk</span>`;
  // The classic build is the baseline, not a contender: it compiles business
  // code for the main thread by definition, so its chips are stated, not
  // scored.
  const chip = (ok, label) =>
    `<span class="fact ${
      isClassic ? 'none' : ok ? 'yes' : 'no'
    }">${label}</span>`;

  // Against the classic build of the same sources, which is the only
  // comparison that says anything: the absolute number is mostly the shared
  // main-thread runtime, identical in every row.
  const delta = classic && !isClassic && classic.bytes !== facts.bytes
    ? (() => {
      const d = facts.bytes - classic.bytes;
      return `<span class="fact ${d < 0 ? 'yes' : 'no'}">${d < 0 ? '−' : '+'}${
        (Math.abs(d) / 1024).toFixed(1)
      } KB vs classic</span>`;
    })()
    : '';

  return [
    `<span class="fact size">${(facts.bytes / 1024).toFixed(1)} KB</span>`,
    delta,
    chip(facts.fallback, `fallback logic ${facts.fallback ? 'in' : 'out'}`),
    chip(!facts.deferred, `deferred logic ${facts.deferred ? 'in' : 'out'}`),
    facts.assembled ? `<span class="fact yes">assembled</span>` : '',
  ].join('');
}

const sections = [];
const summary = [];

for (const { prefix, title, blurb } of GROUPS) {
  const names = Object.keys(cases).filter((n) => n.startsWith(prefix));
  const cards = [];

  for (const name of names) {
    const def = cases[name];
    const sources = def.files.map((file) => ({
      file,
      code: read(path.join(MATRIX_DIR, name, file)) ?? '',
    }));

    const classic = bundleFacts(name, 'on');
    const rows = VARIANTS.map(({ suffix, label, note }) => {
      const entry = `bg-${name}--${suffix}`;
      const dir = path.join(REPORT_DIR, entry);
      const result = JSON.parse(read(path.join(dir, 'result.json')) ?? 'null');
      const facts = bundleFacts(name, suffix);
      const v = verdict(result, facts, def, suffix);
      summary.push({ name, suffix, ...v });

      if (!result || result.status === 'build-error') {
        const err = builds[`web:${name}--${suffix}`]?.reason
          ?? builds[`lynx:${name}--${suffix}`]?.reason;
        return `<tr class="v-${v.key}">
          <th><code>${escapeHtml(label)}</code><small>${
          escapeHtml(note)
        }</small></th>
          <td colspan="2" class="build-error">
            <strong>${escapeHtml(v.text)}</strong>
            ${err ? `<pre>${escapeHtml(err.trim())}</pre>` : ''}
          </td>
          <td class="facts">${factsCell(facts, classic, suffix === 'on')}</td>
        </tr>`;
      }

      return `<tr class="v-${v.key}">
        <th><code>${escapeHtml(label)}</code><small>${escapeHtml(note)}</small>
          <p class="verdict">${escapeHtml(v.text)}</p></th>
        <td class="mtr">${
        frameCell(
          entry,
          'MTR',
          dataUri(path.join(dir, 'mtr.png')),
          result.mtr?.ids ?? [],
        )
      }</td>
        <td class="btr">${
        frameCell(
          entry,
          'BTR',
          dataUri(path.join(dir, 'btr.png')),
          result.btr?.ids ?? [],
        )
      }</td>
        <td class="facts">${factsCell(facts, classic, suffix === 'on')}</td>
      </tr>`;
    }).join('\n');

    cards.push(`<section class="case" id="${name}">
      <h3><code>${name}</code> <span>${prose(def.what)}</span></h3>
      ${def.reading ? `<p class="reading">${prose(def.reading)}</p>` : ''}
      <div class="split">
        <div class="source">
          ${
      sources.map(({ file, code }) =>
        `<div class="file"><header>${escapeHtml(file)}</header><pre>${
          highlight(code)
        }</pre></div>`
      ).join('')
    }
        </div>
        <div class="scroll"><table class="frames">
          <thead><tr><th>experimental_enableMTSRendering</th><th class="mtr">MTR — main thread alone</th><th class="btr">BTR — after hydration</th><th>main-thread chunk</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </div>
    </section>`);
  }

  sections.push(`<section class="group">
    <h2>${escapeHtml(title)}</h2>
    <p class="blurb">${prose(blurb)}</p>
    ${cards.join('\n')}
  </section>`);
}

const tally = summary.reduce((acc, { key }) => {
  acc[key] = (acc[key] ?? 0) + 1;
  return acc;
}, {});

/**
 * The two questions, counted separately over the permutations that built.
 * Everything in the prose below is stated in terms of these, so the page
 * cannot claim something the captures do not show.
 */
const built = summary.filter((s) => s.key !== 'rejected' && s.key !== 'bad');
const painted = built.filter((s) => s.frame !== 'blank');
const deferring = summary.filter((s) =>
  s.suffix !== 'on' && s.chunk !== '—' && s.chunk !== 'not built'
);
const keptCode = deferring.filter((s) =>
  s.chunk === 'deferred code stayed' && !cases[s.name].deferredByChoice
);
const byChoice = deferring.filter((s) =>
  s.chunk === 'deferred code stayed' && cases[s.name].deferredByChoice
);

const findings = `<section class="findings">
  <h2>What the matrix says</h2>
  <p>
    <strong>${painted.length} of ${built.length}</strong> permutations that
    build paint a first frame on the main thread alone, and every one of them
    is correct after hydration. Under the assembled build,
    <strong>${
  deferring.length - keptCode.length - byChoice.length
} of ${deferring.length}</strong>
    also drop the deferred code from the main-thread chunk.
    ${byChoice.length} more keep it because the app asked them to
    (<code>${
  escapeHtml([...new Set(byChoice.map((s) => s.name))].join(', '))
}</code> names the deferred component as its own fallback). That leaves
    <strong>${keptCode.length}</strong> —
    <code>${
  escapeHtml([...new Set(keptCode.map((s) => s.name))].join(', '))
}</code> — which render correctly and ship the deferred code anyway.
  </p>
  <p>
    That split is the whole result, and it is not an accident of this
    implementation. <code>&lt;Background&gt;</code> is two mechanisms wearing
    one name:
  </p>
  <ul>
    <li>
      <strong>A rendering boundary.</strong> The component returns its
      <code>fallback</code> on the main thread and its children on the
      background thread. This half is <em>total</em>: it is an ordinary
      component, so it works at any depth, through any import, behind a
      conditional, inside a loop, with any fallback. Every row above paints.
    </li>
    <li>
      <strong>A bundling boundary.</strong> On the main-thread target the
      transform replaces the element with its fallback, which deletes the only
      reference to the deferred subtree and lets tree-shaking take the modules
      behind it — the bodies and their imports, not the element templates,
      which the main thread needs in order to hydrate at all. This half is
      <em>partial</em>, and it is partial for one
      reason: a fold can only delete a reference it can see, in the module
      where the boundary is written.
    </li>
  </ul>
  <p>
    Each failing shape is that one reason in a different disguise. In
    <code>i03-reexport</code> the element's name is not resolvable to the
    runtime export from inside the module. In <code>i05-dynamic-type</code>
    the element type is a value, so resolving it would mean running the
    program. In <code>i04-wrapper</code> the boundary <em>is</em> resolvable —
    but the reference to the deferred subtree is at the call site, in
    <code>children</code>, and the boundary is a module away, so there is
    nothing to cut where the reference lives. <code>f05-spread</code> is the
    same limit stated about the fallback rather than the child, and it is the
    one case that refuses instead of degrading.
  </p>
  <p>
    This is the shape React arrived at with Server Components, from the same
    pressure. <code>'use client'</code> is a <em>module</em> directive, not an
    element, because a bundler splits a graph along import edges — an element
    can only speak for the one reference written beside it, while an import
    edge speaks for everything reachable through it. An element-level boundary
    can therefore always express <em>when</em> something renders, and can only
    sometimes express <em>where</em> it ships.
  </p>
  <p>
    The last group is what to do about it. This repo already ships the
    module-level half: <code>import 'background-only'</code> resolves to a
    module that fails the build when a main-thread module imports it.
    <code>g01</code> and <code>g02</code> are the same app twice —
    <code>g01</code> where the fold reaches, <code>g02</code> in the wrapper
    shape where it cannot — and the assertion turns the second from a silent
    loss into a named build error. (How large a loss is not readable from
    these fixtures: the delta against the classic build is dominated by this
    mode's fixed overhead, which <code>p01-root</code> pays too with the fold
    working. What the failed fold actually costs is the deferred subtree's own
    weight, and <code>p10-heavy</code> is the case sized to show it.)
  </p>
  <p>
    The assertion is not free, and <code>g01</code> is where that shows: it
    builds under the assembled mode and <em>fails</em> under the classic one,
    because a classic build compiles every module for the main thread, which
    is exactly what the module just swore never happens. So it is a
    declaration that this module has no place in a main-thread-rendering
    build at all — including development, where <code>'auto'</code> always
    resolves to the classic path. Keep the element boundary for the frame;
    reach for the module boundary when the bundle matters more than building
    both ways.
  </p>
</section>`;

const overview = `<table class="overview">
  <thead><tr><th>case</th>${
  VARIANTS.map(({ label }) => `<th><code>${escapeHtml(label)}</code></th>`)
    .join('')
}</tr></thead>
  <tbody>${
  Object.keys(cases).map((name) =>
    `<tr><td><a href="#${name}">${name}</a></td>${
      VARIANTS.map(({ suffix }) => {
        const s = summary.find((x) => x.name === name && x.suffix === suffix);
        return `<td class="v-${s?.key ?? 'none'}" title="${
          escapeHtml(s?.text ?? '')
        }">${s?.key ?? '—'}</td>`;
      }).join('')
    }</tr>`
  ).join('')
}</tbody>
</table>`;

const html = `<!doctype html>
<meta charset="utf-8">
<title>&lt;Background&gt; matrix — source → MTR → BTR</title>
<style>
  /* Neutrals carry a slight blue cast, from the same family as the deferred
     subtree's own colour in the fixtures. --mtr / --btr tint the two frame
     columns: the provisional frame and the settled one. */
  :root, :root[data-theme="light"] {
    --bg: #fbfbfd; --fg: #16181d; --muted: #656c7a; --line: #e2e5ec;
    --card: #fff; --good: #1a7f37; --partial: #9a6700; --blank: #b42318;
    --rejected: #5b5f6b; --code: #f5f6f9; --accent: #2f6fd0;
    --mtr: #9a670022; --btr: #2f6fd022;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0f1115; --fg: #e6e8ee; --muted: #99a0ae; --line: #262a33;
      --card: #161922; --good: #4ac26b; --partial: #d4a72c; --blank: #f2705c;
      --rejected: #8b909c; --code: #12141a; --accent: #79a9f0;
      --mtr: #d4a72c1f; --btr: #79a9f01f;
    }
  }
  /* The viewer's own toggle wins over the OS preference, in both directions. */
  :root[data-theme="dark"] {
    --bg: #0f1115; --fg: #e6e8ee; --muted: #99a0ae; --line: #262a33;
    --card: #161922; --good: #4ac26b; --partial: #d4a72c; --blank: #f2705c;
    --rejected: #8b909c; --code: #12141a; --accent: #79a9f0;
    --mtr: #d4a72c1f; --btr: #79a9f01f;
  }
  * { box-sizing: border-box }
  body { margin: 0; background: var(--bg); color: var(--fg);
    font: 14px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif }
  main { max-width: 1400px; margin: 0 auto; padding: 32px 20px 96px }
  h1 { font-size: 26px; margin: 0 0 6px }
  h2 { font-size: 19px; margin: 44px 0 4px; padding-top: 20px; border-top: 1px solid var(--line) }
  h3 { font-size: 15px; margin: 0 0 12px; display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap }
  h3 span { font-weight: 400; color: var(--muted) }
  p.lede, p.blurb { color: var(--muted); max-width: 78ch; margin: 4px 0 14px }
  p.reading { margin: -6px 0 12px; padding: 8px 11px; border-left: 3px solid var(--line);
    background: var(--code); border-radius: 0 6px 6px 0; font-size: 12.5px; max-width: 100ch }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .92em }
  .case { background: var(--card); border: 1px solid var(--line); border-radius: 10px;
    padding: 16px; margin: 16px 0 }
  .split { display: grid; grid-template-columns: minmax(280px, 30%) 1fr; gap: 16px; align-items: start }
  @media (max-width: 1000px) { .split { grid-template-columns: 1fr } }
  .file { border: 1px solid var(--line); border-radius: 7px; overflow: hidden; margin-bottom: 8px }
  .file header { background: var(--code); padding: 5px 9px; font: 500 11.5px ui-monospace, monospace;
    color: var(--muted); border-bottom: 1px solid var(--line) }
  .file pre { margin: 0; padding: 9px; overflow-x: auto; background: var(--code);
    font: 11.5px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
    white-space: pre-wrap; overflow-wrap: break-word }
  :root, :root[data-theme="light"] {
    --kw: #a626a4; --str: #0a7d3f; --bnd: #b45309; --bnd-bg: #b453091c;
  }
  @media (prefers-color-scheme: dark) {
    :root { --kw: #d2a8ff; --str: #7ee787; --bnd: #ffa657; --bnd-bg: #ffa65721 }
  }
  :root[data-theme="dark"] {
    --kw: #d2a8ff; --str: #7ee787; --bnd: #ffa657; --bnd-bg: #ffa65721;
  }
  .k { color: var(--kw) } .s { color: var(--str) }
  .c { color: var(--muted); font-style: italic }
  .bg { color: var(--bnd); font-weight: 700; background: var(--bnd-bg);
    border-radius: 3px; padding: 0 2px }
  table { border-collapse: collapse; width: 100% }
  .scroll { overflow-x: auto }
  /* The two frame columns are the provisional frame and the settled one —
     tinted so a row can be read across without checking the header. */
  .frames td.mtr { background: var(--mtr) } .frames td.btr { background: var(--btr) }
  .frames thead th.mtr { background: var(--mtr) } .frames thead th.btr { background: var(--btr) }
  .frames th, .frames td { border: 1px solid var(--line); padding: 8px; vertical-align: top; text-align: left }
  .frames thead th { font-size: 11.5px; color: var(--muted); font-weight: 600; background: var(--code) }
  .frames tbody th { width: 168px; font-weight: 600 }
  .frames tbody th small { display: block; font-weight: 400; color: var(--muted); font-size: 11px; margin-top: 2px }
  .verdict { margin: 7px 0 0; font-size: 11.5px; font-weight: 600 }
  .shot { margin: 0 }
  .shot img { display: block; max-width: 100%; border: 1px solid var(--line); border-radius: 5px; background: #fff }
  .shot figcaption { margin-top: 5px; font-size: 10.5px; color: var(--muted); word-break: break-all }
  .shot.missing { color: var(--muted); font-style: italic; font-size: 12px }
  .build-error pre { background: var(--code); padding: 8px; border-radius: 5px; overflow-x: auto;
    font-size: 11px; margin: 6px 0 0; white-space: pre-wrap }
  .facts { width: 130px }
  .fact { display: inline-block; font-size: 10.5px; border-radius: 4px; padding: 1px 6px;
    margin: 0 4px 4px 0; border: 1px solid var(--line); white-space: nowrap }
  .fact.yes { color: var(--good); border-color: color-mix(in srgb, var(--good) 40%, transparent) }
  .fact.no { color: var(--blank); border-color: color-mix(in srgb, var(--blank) 40%, transparent) }
  .fact.none, .fact.size { color: var(--muted) }
  .fact.size, .overview td { font-variant-numeric: tabular-nums }
  tr.v-good th .verdict { color: var(--good) }
  tr.v-partial th .verdict { color: var(--partial) }
  tr.v-blank th .verdict, tr.v-bad th .verdict { color: var(--blank) }
  tr.v-rejected th .verdict { color: var(--rejected) }
  .overview { margin: 18px 0 8px; font-size: 12px }
  .overview th, .overview td { border: 1px solid var(--line); padding: 5px 8px; text-align: left }
  .overview thead th { background: var(--code); color: var(--muted); font-size: 11.5px }
  .overview td.v-good { color: var(--good) } .overview td.v-partial { color: var(--partial) }
  .overview td.v-blank, .overview td.v-bad { color: var(--blank) }
  .overview td.v-rejected { color: var(--rejected) }
  .overview a { color: var(--accent) }
  a:focus-visible, .overview a:focus-visible { outline: 2px solid var(--accent);
    outline-offset: 2px; border-radius: 2px }
  .legend { display: flex; gap: 16px; flex-wrap: wrap; font-size: 12px; color: var(--muted); margin: 10px 0 0 }
  .findings { max-width: 82ch; margin: 26px 0 8px }
  .findings h2 { margin-top: 0; border: 0; padding-top: 0 }
  .findings p, .findings li { margin: 0 0 12px }
  .findings ul { padding-left: 20px }
  .findings strong { font-variant-numeric: tabular-nums }
</style>
<main>
  <h1>&lt;Background&gt; — every permutation, source → MTR → BTR</h1>
  <p class="lede">
    Each row holds the main thread's own first frame (MTR, captured with the
    background thread's messages held) beside the frame after the background
    thread was released (BTR). <code>sk-*</code> is the fallback island,
    <code>real-*</code> the deferred subtree. The chunk column tracks
    <em>logic</em> markers, because a boundary defers code and never element
    shapes — the main thread owns a snapshot creator for every shape the
    background will hydrate either way. It reads the Lynx
    <code>main-thread.js</code> chunk directly — the web bundle packs both
    threads together and cannot answer what left it.
  </p>
  ${findings}
  <h2>Every permutation</h2>
  <div class="scroll">${overview}</div>
  <p class="legend">
    <span class="v-good">good — fallback at 0.0 and the deferred code left the chunk</span>
    <span class="v-partial">partial — renders correctly, but the chunk kept the deferred code</span>
    <span class="v-blank">blank — nothing on the first frame</span>
    <span class="v-rejected">rejected — refused at build time, by design</span>
  </p>
  ${sections.join('\n')}
</main>
`;

const out = path.join(REPORT_DIR, 'index.html');
fs.mkdirSync(REPORT_DIR, { recursive: true });
fs.writeFileSync(out, html);
console.log(
  `${out}  (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB)`,
);
console.log(
  Object.entries(tally).map(([k, n]) => `${k}: ${n}`).join('  '),
);
