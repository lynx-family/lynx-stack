// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Agent as MidsceneAgent } from '@midscene/core/agent';
import type { AbstractInterface } from '@midscene/core/device';

import { getResultDimension } from './core/dimensions.js';
import { toErrorMessage } from './core/errors.js';
import { normalizeJudgeBaseOptions, normalizeSteps } from './core/options.js';
import { judgeWithAgentUnsafe } from './core/scoring.js';
import {
  KittenLynxMidscenePage,
  getKittenLynxPageUrl,
  isKittenLynxPage,
} from './platforms/kitten-lynx-midscene-page.js';
import type {
  JudgeAndroidAgentOptions,
  NormalizedJudgeAndroidAgentOptions,
  UiJudgeResult,
  UiJudgeScore,
} from './types.js';

export async function judgeAndroidAgent(
  options: JudgeAndroidAgentOptions,
): Promise<UiJudgeResult> {
  try {
    const normalized = normalizeJudgeAndroidAgentOptions(options);
    const score = await judgeAndroidAgentUnsafe(normalized);
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
      url: getKittenLynxPageUrl(options?.page),
    };
  }
}

function normalizeJudgeAndroidAgentOptions(
  options: JudgeAndroidAgentOptions,
): NormalizedJudgeAndroidAgentOptions {
  if (!isKittenLynxPage(options?.page)) {
    throw new Error('judgeAndroidAgent requires a Kitten-Lynx page.');
  }

  return {
    ...normalizeJudgeBaseOptions(options, 'judgeAndroidAgent'),
    page: options.page,
  };
}

async function judgeAndroidAgentUnsafe(
  options: NormalizedJudgeAndroidAgentOptions,
): Promise<UiJudgeScore> {
  const page = new KittenLynxMidscenePage(options.page) as AbstractInterface;
  const agent = new MidsceneAgent(
    page,
    {
      autoPrintReportMsg: false,
      generateReport: false,
    },
  );

  try {
    return await judgeWithAgentUnsafe(agent, options);
  } finally {
    await agent.destroy().catch(() => {
      // Keep the original action or scoring error visible.
    });
  }
}
