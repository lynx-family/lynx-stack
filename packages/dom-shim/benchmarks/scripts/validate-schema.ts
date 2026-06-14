// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

function fail(msg: string): never {
  throw new Error(msg);
}

function ok(msg: string): void {
  console.info(`✅ ${msg}`);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const schemaPath = resolve(__dirname, '..', 'schema', 'result.schema.json');

const schema: unknown = JSON.parse(readFileSync(schemaPath, 'utf8'));

const ajv = new Ajv.default({ allErrors: true, strict: true });
addFormats.default(ajv);
const validate = ajv.compile(schema as object);

// ---------------------------------------------------------------------------
// Positive sample — a minimal but complete report.json that MUST validate.
// ---------------------------------------------------------------------------

const positiveSample = {
  schema_version: '1.0.0',
  run_id: 'smoke-test-sample',
  started_at: '2026-06-13T20:00:00Z',
  finished_at: '2026-06-13T20:05:32Z',
  model_id: 'claude-opus-4-7',
  rounds: 3,
  concurrency: 4,
  summary: {
    A: {
      parse_ok_rate: 0.94,
      render_ok_rate: 0.42,
      convergence_rate: 0.58,
      visual_score_mean: 0.32,
      sample_size: 50,
    },
    B: {
      parse_ok_rate: 0.98,
      render_ok_rate: 0.78,
      convergence_rate: 0.86,
      visual_score_mean: 0.61,
      sample_size: 50,
    },
    C: {
      parse_ok_rate: 1.0,
      render_ok_rate: 0.66,
      convergence_rate: 0.72,
      visual_score_mean: null,
      sample_size: 50,
    },
  },
  per_category: {
    interactive: {
      A: { parse_ok_rate: 1, render_ok_rate: 0.5, convergence_rate: 0.75 },
      B: { parse_ok_rate: 1, render_ok_rate: 0.875, convergence_rate: 1 },
      C: { parse_ok_rate: 1, render_ok_rate: 0.625, convergence_rate: 0.75 },
    },
  },
  records: [
    {
      prompt_id: 'P001',
      route: 'A',
      round: 1,
      generated_code: 'const page = __CreatePage(...); ...',
      parse_ok: true,
      render_ok: false,
      screenshot_path: 'screenshots/P001-A-r1.png',
      error_log: 'TypeError: __CreatPage is not a function',
      visual_score: null,
      visual_rationale: null,
      timestamp: '2026-06-13T20:00:12Z',
      model_id: 'claude-opus-4-7',
      tokens_used: { input: 4123, output: 312 },
    },
    {
      prompt_id: 'P001',
      route: 'B',
      round: 1,
      generated_code: '<view><text>0</text></view>',
      parse_ok: true,
      render_ok: true,
      screenshot_path: 'screenshots/P001-B-r1.png',
      error_log: '',
      visual_score: 0.8,
      visual_rationale: 'Counter visible with 0 and two buttons.',
      timestamp: '2026-06-13T20:00:18Z',
      model_id: 'claude-opus-4-7',
      tokens_used: { input: 3892, output: 256 },
    },
  ],
};

if (!validate(positiveSample)) {
  fail(
    `Positive sample failed validation: ${
      JSON.stringify(validate.errors, null, 2)
    }`,
  );
}
ok('Positive sample (minimal complete report) validates.');

// ---------------------------------------------------------------------------
// Negative samples — each MUST fail validation. Confirms schema actually bites.
// ---------------------------------------------------------------------------

interface NegativeCase {
  name: string;
  bad: unknown;
}

const negativeCases: NegativeCase[] = [
  {
    name: 'missing required field schema_version',
    bad: { ...positiveSample, schema_version: undefined },
  },
  {
    name: 'invalid route letter (lowercase)',
    bad: {
      ...positiveSample,
      records: [{ ...positiveSample.records[0], route: 'a' }],
    },
  },
  {
    name: 'invalid prompt_id format',
    bad: {
      ...positiveSample,
      records: [{ ...positiveSample.records[0], prompt_id: 'PROMPT_1' }],
    },
  },
  {
    name: 'visual_score out of [0,1]',
    bad: {
      ...positiveSample,
      records: [{ ...positiveSample.records[0], visual_score: 1.5 }],
    },
  },
  {
    name: 'rounds too large',
    bad: { ...positiveSample, rounds: 99 },
  },
  {
    name: 'unknown extra property at root',
    bad: { ...positiveSample, hacks: 'allowed?' },
  },
];

for (const { name, bad } of negativeCases) {
  const cleaned = JSON.parse(JSON.stringify(bad)) as unknown;
  if (validate(cleaned)) {
    fail(`Negative case "${name}" was accepted but should have been rejected.`);
  }
}
ok(`All ${negativeCases.length} negative cases correctly rejected.`);

console.info('\n✨ Schema validation passed.');
