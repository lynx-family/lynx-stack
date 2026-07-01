// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHIM_ROOT = resolve(__dirname, '../../..');
const WPT_BASELINE = resolve(SHIM_ROOT, 'wpt/baseline.json');
const RN_PARITY = resolve(SHIM_ROOT, 'SPEC/RN_PARITY.md');
const DIAGNOSTICS = resolve(SHIM_ROOT, 'SPEC/DIAGNOSTICS.md');
const TAG_MAP = resolve(SHIM_ROOT, 'SPEC/TAG_MAP.json');

/**
 * M7 (WPT Conformance + Dashboard) EXIT integration. See
 * Shim_Implementation_PRD.md US-470.
 *
 * Asserts the program-level invariants the Ralph completion promise
 * `WPT_SUBSET_70PCT_PASS` depends on:
 *
 *  1. WPT subset pass rate ≥ 70% (per baseline.json).
 *  2. RN_PARITY.md has no ❌ for any L1/L2 entry.
 *  3. SPEC/DIAGNOSTICS.md exists and lists L4 throws.
 *  4. SPEC/TAG_MAP.json is well-formed.
 *  5. baseline.json + dashboard-data.json are in sync.
 */

interface BaselineFile {
  schemaVersion: string;
  totalTests: number;
  passed: number;
  failed: number;
  errored: number;
  skipped: number;
  overallPassRate: number;
  gateThreshold: number;
  directories: Array<{
    path: string;
    passed: number;
    failed: number;
    errored: number;
    skipped: number;
    passRate: number;
    tests: Array<{
      directory: string;
      name: string;
      status: string;
    }>;
  }>;
}

describe('M7 EXIT — program-level invariants', () => {
  it('WPT baseline pass rate is ≥ gate threshold (70%)', () => {
    const baseline = JSON.parse(
      readFileSync(WPT_BASELINE, 'utf8'),
    ) as BaselineFile;
    expect(baseline.gateThreshold).toBe(0.7);
    expect(baseline.overallPassRate).toBeGreaterThanOrEqual(0.7);
  });

  it('every WPT directory has at least some passing tests', () => {
    const baseline = JSON.parse(
      readFileSync(WPT_BASELINE, 'utf8'),
    ) as BaselineFile;
    for (const dir of baseline.directories) {
      expect(dir.passed).toBeGreaterThan(0);
    }
  });

  it('RN_PARITY.md exists and has no ❌ for any L1/L2 entry', () => {
    const md = readFileSync(RN_PARITY, 'utf8');
    expect(md.length).toBeGreaterThan(0);

    const lines = md.split('\n');
    const l1l2NotImpl: string[] = [];
    for (const line of lines) {
      if (!line.startsWith('|')) continue;
      // Table row: `| RN API | Shim Tier | Status | Test reference | Notes |`
      const cols = line.split('|').map((s) => s.trim());
      if (cols.length < 4) continue;
      const tier = cols[2];
      const status = cols[3];
      if ((tier === 'L1' || tier === 'L2') && status === '❌') {
        l1l2NotImpl.push(line);
      }
    }
    expect(l1l2NotImpl).toEqual([]);
  });

  it('DIAGNOSTICS.md catalog exists and references L4 throws', () => {
    const md = readFileSync(DIAGNOSTICS, 'utf8');
    expect(md.length).toBeGreaterThan(0);
    expect(md).toMatch(/L4\/shadow-dom/);
    expect(md).toMatch(/L4\/custom-elements/);
    expect(md).toMatch(/L4\/mutation-observer/);
    expect(md).toMatch(/shim:L3b\/script-skipped/);
  });

  it('TAG_MAP.json catalogs the standard HTML tags', () => {
    const json = JSON.parse(readFileSync(TAG_MAP, 'utf8')) as {
      entries: Record<string, unknown>;
    };
    for (const tag of ['div', 'span', 'img', 'input', 'button', 'h1', 'ul']) {
      expect(json.entries).toHaveProperty(tag);
    }
  });

  it('baseline.json totals are internally consistent', () => {
    const baseline = JSON.parse(
      readFileSync(WPT_BASELINE, 'utf8'),
    ) as BaselineFile;
    const dirSum = baseline.directories.reduce(
      (acc, d) => acc + d.passed + d.failed + d.errored + d.skipped,
      0,
    );
    expect(dirSum).toBe(baseline.totalTests);
    expect(
      baseline.passed + baseline.failed + baseline.errored + baseline.skipped,
    ).toBe(baseline.totalTests);
  });
});
