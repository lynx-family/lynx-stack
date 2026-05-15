#!/usr/bin/env node

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const resultPath = process.env['UI_JUDGE_RESULT_PATH'];

if (!resultPath) {
  throw new Error('UI_JUDGE_RESULT_PATH is required.');
}

try {
  await access(resultPath);
  process.stdout.write(`UI Judge result already exists at ${resultPath}.\n`);
} catch {
  const modelConfigured = Boolean(process.env['MIDSCENE_MODEL_NAME']);
  const stepOutcome = process.env['UI_JUDGE_STEP_OUTCOME'] || 'unknown';
  const payload = {
    dimension: 'visual-correctness',
    reason: modelConfigured
      ? `The UI Judge test step finished with ${stepOutcome} before writing a result.`
      : 'MIDSCENE_MODEL_NAME is not configured; the Midscene scoring test was skipped.',
    score: null,
    status: modelConfigured ? 'failed' : 'skipped',
  };

  await mkdir(dirname(resultPath), { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(payload, null, 2)}\n`);
  process.stdout.write(`Wrote fallback UI Judge result to ${resultPath}.\n`);
}
