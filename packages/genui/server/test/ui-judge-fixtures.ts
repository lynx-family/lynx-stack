// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { JUDGE_DIMENSIONS } from '../agent/common/ui-judge-agent.js';

export function createJudgeScores(scores: number | readonly number[] = 4) {
  return Object.fromEntries(JUDGE_DIMENSIONS.map((dimension, index) => [
    dimension.id,
    {
      score: typeof scores === 'number' ? scores : scores[index],
      reason: `${dimension.title} evidence.`,
      summary: 'Visible details.',
    },
  ]));
}
