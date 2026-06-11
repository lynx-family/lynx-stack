// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { setTimeout as sleep } from 'node:timers/promises';

import { chromium } from '@playwright/test';

import type { CaptureFn, CaptureOptions } from './types.js';

const DEFAULT_MAX_RETRY = 1;
const DEFAULT_NAVIGATION_TIMEOUT_MS = 30_000;

export const defaultCapture: CaptureFn = async (
  options: CaptureOptions,
): Promise<string | undefined> => {
  const requestedRetry = options.maxRetry ?? DEFAULT_MAX_RETRY;
  const normalizedRetry = Number.isFinite(requestedRetry)
    ? Math.ceil(requestedRetry)
    : DEFAULT_MAX_RETRY;
  const maxRetry = Math.max(1, normalizedRetry);
  let latestError: unknown;

  for (let attempt = 1; attempt <= maxRetry; attempt++) {
    try {
      return await captureOnce(options);
    } catch (error) {
      latestError = error;
      if (!options.silent && attempt < maxRetry) {
        console.info(
          `[ui-judge:visual-evaluation] capture retry ${attempt}/${maxRetry}`,
          {
            traceId: options.traceId,
            error: error instanceof Error ? error.message : String(error),
          },
        );
      }
    }
  }

  throw latestError;
};

async function captureOnce(options: CaptureOptions): Promise<string> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(options.targetPageUrl, {
      timeout: DEFAULT_NAVIGATION_TIMEOUT_MS,
      waitUntil: 'load',
    });

    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {
      // Real Lynx pages can keep connections open. Continue with the loaded UI.
    });

    if (options.waitTimeMs && options.waitTimeMs > 0) {
      await sleep(options.waitTimeMs);
    }

    const screenshot = await page.screenshot({
      type: 'png',
    });
    return screenshot.toString('base64');
  } finally {
    await browser.close().catch(() => {
      // Keep the original capture error visible.
    });
  }
}
