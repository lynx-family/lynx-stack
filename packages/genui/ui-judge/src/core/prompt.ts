// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { NormalizedJudgeOptions } from '../types.js';
import { JUDGE_DIMENSION_PROMPTS } from './dimensions.js';

export function buildJudgePrompt(
  options: NormalizedJudgeOptions,
): string {
  const dimensionPrompt = JUDGE_DIMENSION_PROMPTS[options.dimension];
  const reference = options.reference
    ? `\nReference answer or target:\n${options.reference}\n`
    : '';

  return `You are a senior product and design reviewer judging one GEQI dimension of a generated UI.

Dimension:
${dimensionPrompt.title}

Dimension focus:
${dimensionPrompt.focus}

Task:
${options.task}
${reference}
Set Midscene's requested Number result to exactly one integer from 0 to 5.
Do not return a bare JSON number; the structured result must use the Number field.
Do not return "GRADE:", letters, Markdown, prose, or explanation.

Use this 1-5 Likert scale for the requested dimension:
5 = Excellent benchmark: exceptional craft, thoughtful details, and an "aha moment" that exceeds expectations.
4 = Strong professional quality: smooth, comfortable, and aligned with industry best practices.
3 = Acceptable baseline: the core task works with no fatal issue, but the experience is ordinary or under-polished.
2 = Poor with clear defects: noticeable friction, inconsistency, confusion, or frustration.
1 = Disaster or blocker: seriously violates interaction common sense or blocks the core flow and should be redone.
0 = The UI is unrelated, blank, failed to render, impossible to inspect, or completely wrong.

Subcriteria for this dimension:
${
    dimensionPrompt.criteria.map((criterion, index) =>
      `${index + 1}. ${criterion}`
    ).join('\n')
  }

Grading notes:
1. Score only the requested dimension; do not collapse all GEQI dimensions into one general quality score.
2. Variations in capitalization, punctuation, and minor spacing differences are acceptable when semantic intent and required components are present.
3. Unless a specific vertical or horizontal order is explicitly requested, variations in component order within a container are acceptable.
4. Minor label variations that preserve core semantic meaning are acceptable unless exact literal text was requested.
5. Valid optional properties, such as accessibility hints or default values, should not be penalized when they make sense in context.
6. Do not award a high score when required components are missing or substantive behavior is wrong for this dimension.

Think through the criteria internally, then return only the structured Number result.`;
}
