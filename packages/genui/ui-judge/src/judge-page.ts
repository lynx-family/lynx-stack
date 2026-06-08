// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { PlaywrightAgent } from '@midscene/web/playwright';
import type { Page } from '@playwright/test';

import { getResultDimension } from './core/dimensions.js';
import { toErrorMessage } from './core/errors.js';
import {
  normalizeJudgePageOptions,
  normalizeSteps,
} from './core/options.js';
import { judgeWithAgentUnsafe } from './core/scoring.js';
import type {
  JudgePageOptions,
  NormalizedJudgePageOptions,
  UiJudgeResult,
  UiJudgeScore,
} from './types.js';

export async function judgePage(
  options: JudgePageOptions,
): Promise<UiJudgeResult> {
  try {
    const normalized = normalizeJudgePageOptions(options);
    const score = await judgePageUnsafe(normalized);
    return {
      dimension: normalized.dimension,
      score,
      steps: normalized.steps,
      url: normalized.page.url(),
    };
  } catch (error) {
    return {
      dimension: getResultDimension(options?.dimension),
      error: { message: toErrorMessage(error) },
      score: 0,
      steps: normalizeSteps(options?.steps),
      url: getPageUrl(options?.page),
    };
  }
}

async function judgePageUnsafe(
  options: NormalizedJudgePageOptions,
): Promise<UiJudgeScore> {
  await waitForNetworkIdleBestEffort(options.page, options.timeoutMs);

  const agent = new PlaywrightAgent(options.page, {
    autoPrintReportMsg: false,
    generateReport: false,
  });

  try {
    return await judgeWithAgentUnsafe(agent, options, {
      scoreOptions: {
        domIncluded: 'visible-only',
        screenshotIncluded: true,
      },
    });
  } finally {
    await agent.destroy().catch(() => {
      // Keep the original action or scoring error visible.
    });
  }
}

async function waitForNetworkIdleBestEffort(
  page: Page,
  timeoutMs: number,
): Promise<void> {
  try {
    await page.waitForLoadState('networkidle', {
      timeout: Math.min(timeoutMs, 5_000),
    });
  } catch {
    // Many real apps keep connections open. The DOM is already loaded, so
    // continue and let Midscene inspect the current state.
  }
}

function getPageUrl(page: Page | undefined): string {
  try {
    return page?.url() ?? '';
  } catch {
    return '';
  }
}
