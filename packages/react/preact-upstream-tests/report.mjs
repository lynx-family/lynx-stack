#!/usr/bin/env node
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * report.mjs — pass/skip dashboard for preact-upstream-tests.
 *
 * Runs both vitest projects, parses per-file summaries, and prints a grouped
 * coverage table.  Progress goes to stderr; the table goes to stdout so it can
 * be piped / redirected freely.
 *
 * Usage:
 *   pnpm test:report
 *   pnpm test:report > report.txt
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Groupings (order matters — first match wins) ──────────────────────────────
const GROUPS = [
  {
    label: 'Core Reconciliation',
    match: f => /\/(?:render|components|fragments|keys)\.test\.js$/.test(f),
  },
  {
    label: 'Lifecycle Methods',
    match: f => f.includes('/lifecycles/'),
  },
  {
    label: 'Hooks',
    match: f => f.includes('/hooks/test/browser/'),
  },
  {
    label: 'API & Utilities',
    match: () => true, // catch-all
  },
];

// Files excluded from the vitest run (not counted in dashboard totals)
const EXCLUDED = [
  {
    file: 'getDomSibling.test.js',
    tests: 18,
    category: 'test_methodology',
    reason: 'Preact internals: _children VNode attachment',
  },
  { file: 'refs.test.js', tests: 26, category: 'dual_thread', reason: 'BSI refs ≠ DOM nodes (deferred)' },
  {
    file: 'replaceNode.test.js',
    tests: 11,
    category: 'test_methodology',
    reason: 'SSR replaceNode / pre-populated DOM',
  },
];

// Skiplist (with category tags) — used for attribution
const skiplist = JSON.parse(readFileSync(path.resolve(__dirname, 'skiplist.json'), 'utf-8'));

const CATEGORY_LABELS = {
  lynx_not_web: 'Lynx ≠ Web',
  dual_thread: 'Dual-thread / IPC',
  test_methodology: 'Test methodology',
};

// ── Run one vitest project and return per-file stats ──────────────────────────
function runProject(project) {
  process.stderr.write(`  ${project.padEnd(32)} …`);
  const r = spawnSync(
    'npx',
    ['vitest', 'run', '--workspace', 'vitest.workspace.ts', '--project', project],
    { cwd: __dirname, encoding: 'utf-8', maxBuffer: 16 * 1024 * 1024 },
  );
  const output = (r.stdout ?? '') + (r.stderr ?? '');
  const stats = parse(output);
  const total = Object.values(stats).reduce((a, v) => a + v.total, 0);
  const pass = Object.values(stats).reduce((a, v) => a + v.pass, 0);
  process.stderr.write(` done  (${pass}/${total} pass)\n`);
  return stats;
}

// ── Parse vitest verbose output into { file → {total, pass, skip} } ──────────
function parse(raw) {
  // Strip ANSI colour codes first
  // eslint-disable-next-line no-control-regex
  const clean = raw.replace(/\u001b\[[0-9;]*m/g, '');

  // Matches lines like:
  //   ✓ |project| preact/…/file.test.js (12 tests | 4 skipped) 30ms
  //   ↓ |project| preact/…/file.test.js (11 tests | 11 skipped)
  //   ✓ |project| preact/…/file.test.js (1 test) 6ms
  const re = /\|[^|]+\|\s+(preact[^\s(]+\.test\.js)\s+\((\d+) tests?(?:\s*\|\s*(\d+) skipped)?\)/g;
  const stats = {};
  for (const m of clean.matchAll(re)) {
    const file = m[1].trim();
    const total = +m[2];
    const skip = m[3] ? +m[3] : 0;
    stats[file] = { total, skip, pass: total - skip };
  }
  return stats;
}

// ── Formatting helpers ────────────────────────────────────────────────────────
const groupOf = f => GROUPS.find(g => g.match(f));
const sum = (obj, k) => Object.values(obj).reduce((a, v) => a + v[k], 0);
const pct = (n, d) => d ? `${Math.round(n * 100 / d)}%` : '—';
const lp = (s, n) => String(s).padStart(n);
const rp = (s, n) => String(s).padEnd(n);
const shortName = f =>
  f
    .replace('preact/hooks/test/browser/', 'hooks/')
    .replace('preact/test/browser/lifecycles/', 'lifecycles/')
    .replace('preact/test/browser/', '');

const out = (...a) => process.stdout.write(a.join('') + '\n');

// ── Collect data ──────────────────────────────────────────────────────────────
process.stderr.write('\nCollecting results:\n');
const nc = runProject('preact-upstream');
const co = runProject('preact-upstream-compiled');
const files = [...new Set([...Object.keys(nc), ...Object.keys(co)])].sort();
process.stderr.write('\n');

// ── Overall totals ────────────────────────────────────────────────────────────
const ncT = sum(nc, 'total'), ncP = sum(nc, 'pass'), ncS = sum(nc, 'skip');
const coT = sum(co, 'total'), coP = sum(co, 'pass'), coS = sum(co, 'skip');
const exTests = EXCLUDED.reduce((a, e) => a + e.tests, 0);

const LINE = '─'.repeat(78);
out(LINE);
out('  Preact Upstream Tests — Coverage Dashboard');
out(LINE);
out(`  Excluded (not counted): ${EXCLUDED.map(e => `${e.file} (${e.tests})`).join(', ')} = ${exTests}×2 test cases`);
out();

out('OVERALL');
out(`  ${''.padEnd(22)}  ${'no-compile'.padEnd(20)}  compiled`);
out(`  ${rp('Total', 22)}  ${lp(ncT, 20)}  ${coT}`);
out(`  ${rp('Pass', 22)}  ${rp(`${ncP}  (${pct(ncP, ncT)})`, 20)}  ${coP}  (${pct(coP, coT)})`);
out(`  ${rp('Skip', 22)}  ${rp(`${ncS}  (${pct(ncS, ncT)})`, 20)}  ${coS}  (${pct(coS, coT)})`);
out();

// ── By group ──────────────────────────────────────────────────────────────────
out(`  ${rp('GROUP', 22)}  ${rp('total', 6)}  ${rp('no-compile  pass/skip/%', 26)}  compiled  pass/skip/%`);
out('  ' + '─'.repeat(74));

for (const { label } of GROUPS) {
  const gf = files.filter(f => groupOf(f)?.label === label);
  if (gf.length === 0) continue;

  const gt = gf.reduce((a, f) => a + (nc[f]?.total ?? co[f]?.total ?? 0), 0);
  const ncp = gf.reduce((a, f) => a + (nc[f]?.pass ?? 0), 0);
  const ncs = gf.reduce((a, f) => a + (nc[f]?.skip ?? 0), 0);
  const cop = gf.reduce((a, f) => a + (co[f]?.pass ?? 0), 0);
  const cos = gf.reduce((a, f) => a + (co[f]?.skip ?? 0), 0);

  out(
    `  ${rp(label, 22)}  ${lp(gt, 6)}  `
      + `${rp(`${ncp}/${ncs}  (${pct(ncp, gt)})`, 26)}  `
      + `${cop}/${cos}  (${pct(cop, gt)})`,
  );
}
out();

// ── Per-file detail ───────────────────────────────────────────────────────────
out('PER FILE  (pass/skip/%)');
out('  ' + '─'.repeat(74));

for (const { label } of GROUPS) {
  const gf = files.filter(f => groupOf(f)?.label === label).sort();
  if (gf.length === 0) continue;
  out(`\n  ── ${label}`);
  for (const file of gf) {
    const ns = nc[file] ?? { pass: 0, skip: 0, total: 0 };
    const cs = co[file] ?? { pass: 0, skip: 0, total: 0 };
    const tot = ns.total || cs.total;
    const ncStr = `${lp(ns.pass, 3)}/${lp(ns.skip, 3)}  ${lp(pct(ns.pass, tot), 4)}`;
    const coStr = `${lp(cs.pass, 3)}/${lp(cs.skip, 3)}  ${lp(pct(cs.pass, tot), 4)}`;
    out(`  ${rp(shortName(file), 42)}  nc: ${ncStr}   co: ${coStr}`);
  }
}
out();

// ── Excluded files ────────────────────────────────────────────────────────────
out('EXCLUDED FILES  (vitest exclude — not reflected above)');
out('  ' + '─'.repeat(74));
for (const { file, tests, category, reason } of EXCLUDED) {
  out(`  ${rp(file, 32)}  ${lp(tests, 2)} tests/mode  [${CATEGORY_LABELS[category]}]  ${reason}`);
}
out(`\n  Total: ${exTests} tests × 2 modes = ${exTests * 2} test cases`);
out();

// ── Skip attribution ──────────────────────────────────────────────────────────
// For named entries: count test names × mode factor (1 per mode the list applies to).
// For unsupported_features: all lynx_not_web, inferred as actual_skip − named_skip.
// Excluded files are added separately using their own category tags.

function countByCat(entries, factor = 1) {
  const acc = {};
  for (const entry of (entries ?? [])) {
    const cat = entry.category;
    acc[cat] = (acc[cat] ?? 0) + entry.tests.length * factor;
  }
  return acc;
}

function mergeCounts(...maps) {
  const out = {};
  for (const m of maps) for (const [k, v] of Object.entries(m)) out[k] = (out[k] ?? 0) + v;
  return out;
}

// Named skips per mode (each test name counted once per mode the list applies to)
const ncNamedCats = mergeCounts(
  countByCat(skiplist.skip_list),
  countByCat(skiplist.permanent_skip_list),
  countByCat(skiplist.nocompile_skip_list),
);
const coNamedCats = mergeCounts(
  countByCat(skiplist.skip_list),
  countByCat(skiplist.permanent_skip_list),
  countByCat(skiplist.compiler_skip_list),
);

// unsupported_features contribution = actual skip − named skips (all lynx_not_web)
const ncNamedTotal = Object.values(ncNamedCats).reduce((a, v) => a + v, 0);
const coNamedTotal = Object.values(coNamedCats).reduce((a, v) => a + v, 0);
ncNamedCats.lynx_not_web = (ncNamedCats.lynx_not_web ?? 0) + (ncS - ncNamedTotal);
coNamedCats.lynx_not_web = (coNamedCats.lynx_not_web ?? 0) + (coS - coNamedTotal);

// Add excluded files
for (const { tests, category } of EXCLUDED) {
  ncNamedCats[category] = (ncNamedCats[category] ?? 0) + tests;
  coNamedCats[category] = (coNamedCats[category] ?? 0) + tests;
}

const ncGrand = ncS + exTests;
const coGrand = coS + exTests;

out('SKIP ATTRIBUTION  (skipped + excluded, per mode)');
out(`  Note: unsupported_features counts inferred (actual skip − named skip), all Lynx ≠ Web`);
out('  ' + '─'.repeat(74));
out(`  ${rp('Category', 22)}  ${rp('no-compile', 16)}  ${rp('compiled', 16)}  combined`);
out('  ' + '─'.repeat(74));

for (const [cat, label] of Object.entries(CATEGORY_LABELS)) {
  const nc_ = ncNamedCats[cat] ?? 0;
  const co_ = coNamedCats[cat] ?? 0;
  const total_ = nc_ + co_;
  out(
    `  ${rp(label, 22)}  `
      + `${rp(`${nc_}  (${pct(nc_, ncGrand)})`, 16)}  `
      + `${rp(`${co_}  (${pct(co_, coGrand)})`, 16)}  `
      + `${total_}  (${pct(total_, ncGrand + coGrand)})`,
  );
}

out('  ' + '─'.repeat(74));
out(`  ${rp('Total not running', 22)}  ${rp(`${ncGrand}`, 16)}  ${rp(`${coGrand}`, 16)}  ${ncGrand + coGrand}`);
out(`  ${rp('  of which: skipped', 22)}  ${rp(`${ncS}`, 16)}  ${rp(`${coS}`, 16)}  ${ncS + coS}`);
out(`  ${rp('  of which: excluded', 22)}  ${rp(`${exTests}`, 16)}  ${rp(`${exTests}`, 16)}  ${exTests * 2}`);
out(LINE);
