// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SUBSET_PATH = resolve(__dirname, '../../../wpt/subset.json');

interface SubsetFile {
  schemaVersion: string;
  source: string;
  commitSha: string;
  totalTests: number;
  gateThreshold: number;
  directories: Array<{
    path: string;
    expectedPassRate: number;
    tests: string[];
  }>;
}

const subset = JSON.parse(readFileSync(SUBSET_PATH, 'utf8')) as SubsetFile;

describe('US-461 WPT subset definition', () => {
  it('has schemaVersion', () => {
    expect(subset.schemaVersion).toBe('1');
  });

  it('declares the source repo', () => {
    expect(subset.source).toBe('web-platform-tests/wpt');
  });

  it('gate threshold is 0.70 per US-465', () => {
    expect(subset.gateThreshold).toBe(0.7);
  });

  it('totalTests matches sum of tests across directories', () => {
    const counted = subset.directories.reduce(
      (acc, d) => acc + d.tests.length,
      0,
    );
    expect(counted).toBe(subset.totalTests);
  });

  it('stays under the 500-test budget per US-461', () => {
    expect(subset.totalTests).toBeLessThanOrEqual(500);
  });

  it('every directory has a positive expectedPassRate ≤ 1', () => {
    for (const d of subset.directories) {
      expect(d.expectedPassRate).toBeGreaterThan(0);
      expect(d.expectedPassRate).toBeLessThanOrEqual(1);
    }
  });

  it('every directory has at least one test', () => {
    for (const d of subset.directories) {
      expect(d.tests.length).toBeGreaterThan(0);
    }
  });

  it('test names are unique within each directory', () => {
    for (const d of subset.directories) {
      const set = new Set(d.tests);
      expect(set.size).toBe(d.tests.length);
    }
  });

  it('directory paths cover the in-scope WPT areas per SUBSET.md', () => {
    const paths = new Set(subset.directories.map((d) => d.path));
    for (
      const expected of [
        'dom/nodes/read',
        'dom/nodes/write',
        'dom/events',
        'dom/lists',
        'dom/abort',
        'html/dom/innerhtml',
        'html/dom/global-attributes',
        'css/cssom',
        'selectors',
      ]
    ) {
      expect(paths.has(expected)).toBe(true);
    }
  });
});
