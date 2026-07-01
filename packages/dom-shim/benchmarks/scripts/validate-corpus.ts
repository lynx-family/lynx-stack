// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const VALID_CATEGORIES = [
  'interactive',
  'form',
  'layout',
  'list',
  'media',
  'navigation',
  'data-display',
] as const;
type Category = typeof VALID_CATEGORIES[number];

const VALID_COMPLEXITIES = [
  'trivial',
  'simple',
  'moderate',
  'complex',
] as const;
type Complexity = typeof VALID_COMPLEXITIES[number];

interface CorpusEntry {
  id: string;
  category: Category;
  prompt: string;
  expected_capabilities: string[];
  complexity: Complexity;
}

function fail(msg: string): never {
  throw new Error(msg);
}

function ok(msg: string): void {
  console.info(`✅ ${msg}`);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const corpusPath = resolve(__dirname, '..', 'corpus', 'prompts.json');

let raw: string;
try {
  raw = readFileSync(corpusPath, 'utf8');
} catch (err) {
  fail(`Cannot read corpus file at ${corpusPath}: ${(err as Error).message}`);
}

let parsed: unknown;
try {
  parsed = JSON.parse(raw);
} catch (err) {
  fail(`Corpus is not valid JSON: ${(err as Error).message}`);
}

if (!Array.isArray(parsed)) {
  fail('Corpus root must be an array.');
}

if (parsed.length !== 50) {
  fail(`Corpus must have exactly 50 entries (found ${parsed.length}).`);
}
ok(`Corpus has exactly 50 entries.`);

const seenIds = new Set<string>();
const categoryCounts: Record<Category, number> = {
  interactive: 0,
  form: 0,
  layout: 0,
  list: 0,
  media: 0,
  navigation: 0,
  'data-display': 0,
};
const complexityCounts: Record<Complexity, number> = {
  trivial: 0,
  simple: 0,
  moderate: 0,
  complex: 0,
};

for (let i = 0; i < parsed.length; i++) {
  const entry = parsed[i] as Partial<CorpusEntry>;
  const where = `entry #${i} (id=${String(entry.id ?? '?')})`;

  if (typeof entry.id !== 'string' || !/^P\d{3}$/.test(entry.id)) {
    fail(
      `${where}: id must match /^P\\d{3}$/, got ${JSON.stringify(entry.id)}`,
    );
  }
  if (seenIds.has(entry.id)) {
    fail(`${where}: duplicate id`);
  }
  seenIds.add(entry.id);

  if (
    typeof entry.category !== 'string'
    || !VALID_CATEGORIES.includes(entry.category)
  ) {
    fail(
      `${where}: category must be one of ${VALID_CATEGORIES.join(', ')}, got ${
        JSON.stringify(entry.category)
      }`,
    );
  }
  categoryCounts[entry.category]++;

  if (typeof entry.prompt !== 'string' || entry.prompt.trim().length < 20) {
    fail(`${where}: prompt must be a non-trivial string (>= 20 chars)`);
  }

  if (
    !Array.isArray(entry.expected_capabilities)
    || entry.expected_capabilities.length === 0
    || !entry.expected_capabilities.every((c: unknown) =>
      typeof c === 'string' && c.length > 0
    )
  ) {
    fail(`${where}: expected_capabilities must be a non-empty string array`);
  }

  if (
    typeof entry.complexity !== 'string'
    || !VALID_COMPLEXITIES.includes(entry.complexity)
  ) {
    fail(
      `${where}: complexity must be one of ${
        VALID_COMPLEXITIES.join(', ')
      }, got ${JSON.stringify(entry.complexity)}`,
    );
  }
  complexityCounts[entry.complexity]++;
}

ok('All entries have valid shape, unique IDs, and concrete capabilities.');

// Category distribution: no category < 5 or > 12
for (const cat of VALID_CATEGORIES) {
  const n = categoryCounts[cat];
  if (n < 5 || n > 12) {
    fail(`Category "${cat}" has ${n} entries (must be between 5 and 12).`);
  }
}
ok(`Category distribution: ${JSON.stringify(categoryCounts)}`);

// Complexity distribution (PRD §3 US-102): ~15 trivial / ~20 simple / ~10 moderate / ~5 complex
// Enforce loose tolerance: each within +/-5 of the target, totaling 50.
const COMPLEXITY_TARGETS: Record<Complexity, [number, number]> = {
  trivial: [10, 20],
  simple: [15, 25],
  moderate: [5, 15],
  complex: [3, 8],
};
for (const c of VALID_COMPLEXITIES) {
  const n = complexityCounts[c];
  const [lo, hi] = COMPLEXITY_TARGETS[c];
  if (n < lo || n > hi) {
    fail(`Complexity "${c}" has ${n} entries (target window ${lo}-${hi}).`);
  }
}
ok(`Complexity distribution: ${JSON.stringify(complexityCounts)}`);

console.info('\n✨ Corpus validation passed.');
