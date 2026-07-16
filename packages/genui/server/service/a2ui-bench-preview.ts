// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Browser-backed bench previews are being split out of genui-server. Keep the
// Playwright import disabled until a browser-capable bench service owns it.
// import type { Browser, LaunchOptions } from 'playwright-core';

import type { BenchJobRequest, BenchScenarioRequest } from './a2ui-bench-types';
import type { A2UIMessage } from '../agent/a2ui-validator';

interface BenchPreviewOptions {
  messages: A2UIMessage[];
  request: BenchJobRequest;
  runId: string;
  scenario: BenchScenarioRequest;
}

interface BenchPreviewResult {
  errors: string[];
  fmpMs: number;
  judgeScore: number;
  renderMs: number;
  screenshotDataUrl?: string;
  ttiMs: number;
}

export const BROWSER_BENCH_PREVIEW_ENABLED: boolean = false;
export const BROWSER_BENCH_PREVIEW_DISABLED_MESSAGE =
  'preview render skipped: browser-backed bench preview is disabled in genui-server';

export function runBenchPreview(
  options: BenchPreviewOptions,
): Promise<BenchPreviewResult> {
  const shouldRender = options.request.settings.renderMetricsEnabled
    || options.request.settings.judgeEnabled;
  const errors = shouldRender && options.messages.length > 0
    ? [BROWSER_BENCH_PREVIEW_DISABLED_MESSAGE]
    : [];

  return Promise.resolve({
    errors,
    fmpMs: 0,
    judgeScore: 0,
    renderMs: 0,
    ttiMs: 0,
  });
}
