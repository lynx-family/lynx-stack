// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import {
  BROWSER_BENCH_PREVIEW_DISABLED_MESSAGE,
  BROWSER_BENCH_PREVIEW_ENABLED,
  runBenchPreview,
} from '../service/a2ui-bench-preview.js';
import type {
  BenchJobRequest,
  BenchScenarioRequest,
} from '../service/a2ui-bench-types.js';

const scenario: BenchScenarioRequest = {
  id: 'scenario',
  name: 'Scenario',
  prompt: 'Build a card',
  type: 'test',
};

function request(
  renderMetricsEnabled: boolean,
  judgeEnabled: boolean,
): BenchJobRequest {
  return {
    provider: {},
    settings: {
      repeats: 1,
      parallelism: 1,
      maxRepairAttempts: 0,
      repairEnabled: false,
      judgeEnabled,
      renderMetricsEnabled,
    },
    groups: [],
    scenarios: [scenario],
  };
}

describe('runBenchPreview', () => {
  test('reports browser-backed preview requests as disabled', async () => {
    expect(BROWSER_BENCH_PREVIEW_ENABLED).toBe(false);

    await expect(
      runBenchPreview({
        messages: [{
          version: 'v0.9',
          createSurface: {
            surfaceId: 'surface',
            catalogId: 'catalog',
          },
        }],
        request: request(true, false),
        runId: 'run',
        scenario,
      }),
    ).resolves.toEqual({
      errors: [BROWSER_BENCH_PREVIEW_DISABLED_MESSAGE],
      fmpMs: 0,
      judgeScore: 0,
      renderMs: 0,
      ttiMs: 0,
    });
  });

  test('does not report an error when no browser capability was requested', async () => {
    await expect(
      runBenchPreview({
        messages: [],
        request: request(false, false),
        runId: 'run',
        scenario,
      }),
    ).resolves.toEqual({
      errors: [],
      fmpMs: 0,
      judgeScore: 0,
      renderMs: 0,
      ttiMs: 0,
    });
  });
});
