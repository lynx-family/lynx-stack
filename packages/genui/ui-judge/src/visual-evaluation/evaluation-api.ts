// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { DeviceAction, Size } from '@midscene/core';
import { Agent as MidsceneAgent } from '@midscene/core/agent';
import { callAIWithStringResponse } from '@midscene/core/ai-model';
import type { ChatCompletionMessageParam } from '@midscene/core/ai-model';
import type { AbstractInterface } from '@midscene/core/device';
import sharp from 'sharp';

import { createVisualEvaluationError } from './errors.js';
import type { EvaluationResult } from './types.js';

type EvaluationIssue = NonNullable<EvaluationResult['issues']>[number];

const ALLOWED_ISSUE_CATEGORIES = new Set([
  'layout',
  'spacing',
  'typography',
  'color',
  'asset',
  'state',
  'completeness',
  'other',
]);

export const VISUAL_EVALUATION_SYSTEM_PROMPT =
  `You are a strict visual quality evaluator for UI implementation fidelity.

You compare two UI screenshots:
1. reference_image: the target visual baseline
2. rendered_image: the implementation screenshot

Your job is to judge how closely rendered_image matches reference_image.
Evaluate only visual fidelity. Do not judge code quality, implementation method, accessibility, or product semantics unless they visibly affect the screenshot.

Return valid JSON only. Do not wrap the JSON in markdown. Do not include comments.`;

export const VISUAL_EVALUATION_USER_PROMPT =
  `Compare reference_image and rendered_image for UI visual fidelity.

Scoring:
- Return "score" as a number from 0 to 1.
- 1.00 means visually indistinguishable except for negligible anti-aliasing or compression noise.
- 0.90-0.99 means excellent match with only tiny spacing, antialiasing, or color differences.
- 0.75-0.89 means good match but visible differences exist in spacing, typography, color, sizing, or minor missing details.
- 0.50-0.74 means partial match: overall structure is recognizable, but several important visual differences are present.
- 0.25-0.49 means weak match: major layout, content, styling, or hierarchy differences.
- 0.00-0.24 means unrelated or mostly incorrect rendering.

Evaluate these dimensions:
1. Layout and hierarchy: positions, alignment, grouping, size relationships, and overall structure.
2. Spacing and geometry: margins, padding, gaps, border radii, widths, heights, and crop/overflow behavior.
3. Typography: text content visibility, font size, weight, line height, truncation, alignment, and color.
4. Color and visual style: backgrounds, fills, strokes, opacity, shadows, gradients, and contrast.
5. Assets and icons: image presence, aspect ratio, crop, icon shape, and visual placement.
6. State fidelity: selected states, disabled states, active tabs, badges, overlays, and other visible UI states.
7. Completeness: missing, extra, duplicated, or incorrectly ordered visible elements.

Ignore:
- Tiny anti-aliasing differences.
- Minor compression artifacts.
- Subpixel differences that do not change perceived layout.
- Device screenshot noise that does not affect UI content.

Do not ignore:
- Missing text or incorrect text.
- Incorrect hierarchy or reordered sections.
- Noticeably wrong color, font size, weight, spacing, border radius, or image crop.
- Extra visible UI elements not present in the reference.
- Missing visible UI elements from the reference.

Return JSON with this exact shape:
{
  "score": number,
  "reason": string,
  "summary": string,
  "issues": [
    {
      "category": "layout" | "spacing" | "typography" | "color" | "asset" | "state" | "completeness" | "other",
      "severity": "low" | "medium" | "high",
      "description": string
    }
  ]
}

Rules for the JSON:
- "score" must be between 0 and 1.
- "reason" must be one concise sentence explaining the score.
- "summary" must be a short paragraph summarizing the overall visual match.
- "issues" must list the most important visible differences, ordered by severity.
- If the images are nearly identical, use an empty "issues" array.
- Mention approximate regions such as "top bar", "main card", "bottom section", or "right icon" when describing issues.
- Do not invent hidden or non-visible differences.`;

interface MidsceneVisualEvaluationAgent {
  modelConfigManager: {
    getModelConfig(
      intent: 'insight',
    ): Parameters<typeof callAIWithStringResponse>[1];
  };
  destroy(): Promise<void>;
}

class StaticImageMidscenePage {
  interfaceType = 'static';

  constructor(
    private readonly screenshotDataUrl: string,
    private readonly screenshotSize: Size,
  ) {}

  actionSpace(): DeviceAction[] {
    return [];
  }

  screenshotBase64(): Promise<string> {
    return Promise.resolve(this.screenshotDataUrl);
  }

  size(): Promise<Size> {
    return Promise.resolve(this.screenshotSize);
  }

  describe(): string {
    return 'visual-evaluation static rendered image';
  }

  destroy(): Promise<void> {
    return Promise.resolve();
  }
}

export async function evaluateImagesWithMidscene(
  referenceImageDataUrl: string,
  renderedImageDataUrl: string,
): Promise<EvaluationResult> {
  const screenshotSize = await getDataUrlImageSize(renderedImageDataUrl);
  const page = new StaticImageMidscenePage(
    renderedImageDataUrl,
    screenshotSize,
  ) as AbstractInterface;
  const agent = new MidsceneAgent(page, {
    autoPrintReportMsg: false,
    generateReport: false,
  }) as MidsceneVisualEvaluationAgent;
  const messages = buildVisualEvaluationMessages(
    referenceImageDataUrl,
    renderedImageDataUrl,
  );

  try {
    const modelConfig = agent.modelConfigManager.getModelConfig('insight');
    const { content } = await callAIWithStringResponse(messages, modelConfig);
    return normalizeEvaluationResult(content);
  } finally {
    await agent.destroy().catch(() => {
      // Keep the original evaluation error visible.
    });
  }
}

export function normalizeEvaluationResult(raw: unknown): EvaluationResult {
  let parsed: unknown;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    throw createVisualEvaluationError(
      502,
      'EVALUATION_API_ERROR',
      'Evaluation result must be valid JSON.',
    );
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw createVisualEvaluationError(
      502,
      'EVALUATION_API_ERROR',
      'Evaluation result must be a JSON object.',
    );
  }

  const candidate = parsed as Record<string, unknown>;
  const score = typeof candidate['score'] === 'number'
    ? candidate['score']
    : Number(candidate['score']);
  if (!Number.isFinite(score)) {
    throw createVisualEvaluationError(
      502,
      'EVALUATION_API_ERROR',
      'Evaluation result is missing numeric score.',
    );
  }

  const result: EvaluationResult = {
    ...candidate,
    issues: normalizeEvaluationIssues(candidate['issues']),
    score: Math.max(0, Math.min(1, score)),
  };

  if (typeof candidate['reason'] !== 'string') {
    throw createVisualEvaluationError(
      502,
      'EVALUATION_API_ERROR',
      'Evaluation result is missing required "reason" string.',
    );
  }
  if (typeof candidate['summary'] !== 'string') {
    throw createVisualEvaluationError(
      502,
      'EVALUATION_API_ERROR',
      'Evaluation result is missing required "summary" string.',
    );
  }

  result.reason = candidate['reason'];
  result.summary = candidate['summary'];

  return result;
}

function buildVisualEvaluationMessages(
  referenceImageDataUrl: string,
  renderedImageDataUrl: string,
): ChatCompletionMessageParam[] {
  return [
    {
      content: VISUAL_EVALUATION_SYSTEM_PROMPT,
      role: 'system',
    },
    {
      content: [
        {
          text: VISUAL_EVALUATION_USER_PROMPT,
          type: 'text',
        },
        {
          image_url: {
            url: referenceImageDataUrl,
          },
          type: 'image_url',
        },
        {
          image_url: {
            url: renderedImageDataUrl,
          },
          type: 'image_url',
        },
      ],
      role: 'user',
    },
  ];
}

function normalizeEvaluationIssues(value: unknown): EvaluationIssue[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((issue) => isEvaluationIssue(issue));
}

function isEvaluationIssue(value: unknown): value is EvaluationIssue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const issue = value as Record<string, unknown>;
  return typeof issue['category'] === 'string'
    && ALLOWED_ISSUE_CATEGORIES.has(issue['category'])
    && typeof issue['description'] === 'string'
    && (
      issue['severity'] === 'low'
      || issue['severity'] === 'medium'
      || issue['severity'] === 'high'
    );
}

async function getDataUrlImageSize(dataUrl: string): Promise<Size> {
  const commaIndex = dataUrl.indexOf(',');
  const base64 = commaIndex === -1 ? dataUrl : dataUrl.slice(commaIndex + 1);
  const metadata = await sharp(Buffer.from(base64, 'base64')).metadata();
  if (!metadata.width || !metadata.height) {
    throw createVisualEvaluationError(
      502,
      'EVALUATION_API_ERROR',
      'Unable to extract image dimensions for visual evaluation.',
    );
  }
  return {
    height: metadata.height,
    width: metadata.width,
  };
}
