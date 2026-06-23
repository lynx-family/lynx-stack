// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createOpenAI } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import type { AgentConfig } from '@mastra/core/agent';

import { createVisualEvaluationError } from './errors.js';
import type {
  EvaluationResult,
  VisualEvaluationAgent,
  VisualEvaluationAgentOptions,
} from './types.js';

type EvaluationIssue = NonNullable<EvaluationResult['issues']>[number];

export interface VisualEvaluationTextPart {
  text: string;
  type: 'text';
}

export interface VisualEvaluationImagePart {
  image: string;
  mimeType: string;
  type: 'image';
}

export interface VisualEvaluationMessage {
  content: Array<VisualEvaluationImagePart | VisualEvaluationTextPart>;
  role: 'user';
}

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

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o-mini';

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
- Screenshot capture noise that does not affect UI content.

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

interface OpenAIEnv {
  OPENAI_API_KEY?: string | undefined;
  OPENAI_API_STYLE?: 'chat' | 'responses' | undefined;
  OPENAI_BASE_URL?: string | undefined;
  OPENAI_MODEL?: string | undefined;
}

type CompatRequestBody = {
  messages?: Array<{ role?: string }>;
};

export async function evaluateImagesWithAgent(
  referenceImageDataUrl: string,
  renderedImageDataUrl: string,
  options: VisualEvaluationAgentOptions = {},
): Promise<EvaluationResult> {
  const agent = options.agent ?? createVisualEvaluationAgent(options);
  const messages = buildVisualEvaluationMessages(
    referenceImageDataUrl,
    renderedImageDataUrl,
  );
  const rawResult = await agent.generate(
    messages,
    options.resourceId ? { resourceId: options.resourceId } : undefined,
  );
  return normalizeEvaluationResult(extractAgentEvaluationPayload(rawResult));
}

export function buildVisualEvaluationMessages(
  referenceImageDataUrl: string,
  renderedImageDataUrl: string,
): VisualEvaluationMessage[] {
  return [
    {
      content: [
        {
          text: VISUAL_EVALUATION_USER_PROMPT,
          type: 'text',
        },
        imagePartFromDataUrl(referenceImageDataUrl),
        imagePartFromDataUrl(renderedImageDataUrl),
      ],
      role: 'user',
    },
  ];
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

function createVisualEvaluationAgent(
  options: VisualEvaluationAgentOptions,
): VisualEvaluationAgent {
  const env = process.env as OpenAIEnv;
  const apiKey = options.apiKey ?? env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OpenAI credentials not provided: set OPENAI_API_KEY env var or pass apiKey',
    );
  }

  const baseURL = options.baseURL ?? env.OPENAI_BASE_URL ?? DEFAULT_BASE_URL;
  const model = options.model ?? env.OPENAI_MODEL ?? DEFAULT_MODEL;
  const isOfficial = isOfficialOpenAIBaseURL(baseURL);
  const api = options.api
    ?? env.OPENAI_API_STYLE
    ?? (isOfficial ? 'responses' : 'chat');
  const provider = createOpenAI({
    apiKey,
    baseURL,
    ...(isOfficial ? {} : { fetch: createCompatFetch() }),
  });
  const buildModel = (id: string): AgentConfig['model'] =>
    api === 'chat' ? provider.chat(id) : provider(id);

  return new Agent({
    id: 'visual-evaluation-agent',
    instructions: VISUAL_EVALUATION_SYSTEM_PROMPT,
    model: buildModel(model),
    name: 'VisualEvaluationAgent',
  }) as unknown as VisualEvaluationAgent;
}

function imagePartFromDataUrl(dataUrl: string): VisualEvaluationImagePart {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) {
    throw createVisualEvaluationError(
      502,
      'EVALUATION_API_ERROR',
      'Evaluation image must be a base64 data URL.',
    );
  }

  return {
    image: match[2]!.replace(/\s+/g, ''),
    mimeType: match[1]!,
    type: 'image',
  };
}

function extractAgentEvaluationPayload(raw: unknown): unknown {
  if (typeof raw === 'string') return raw;
  if (!isRecord(raw)) return raw;

  if (isRecord(raw['object'])) {
    return raw['object'];
  }
  if (typeof raw['text'] === 'string') {
    return raw['text'];
  }

  const response = raw['response'];
  if (isRecord(response)) {
    const text = extractResponseMessagesText(response['messages']);
    if (text) return text;
  }

  return raw;
}

function extractResponseMessagesText(messages: unknown): string | undefined {
  if (!Array.isArray(messages)) return undefined;
  const textParts: string[] = [];
  for (const message of messages) {
    if (!isRecord(message)) continue;
    const content = message['content'];
    if (typeof content === 'string') {
      textParts.push(content);
      continue;
    }
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (typeof part === 'string') {
        textParts.push(part);
      } else if (isRecord(part) && typeof part['text'] === 'string') {
        textParts.push(part['text']);
      }
    }
  }
  return textParts.length > 0 ? textParts.join('\n') : undefined;
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

function createCompatFetch(): typeof fetch {
  return async (input, init) => {
    if (!init || !init.body || typeof init.body !== 'string') {
      return fetch(input, init);
    }
    let body = init.body;
    try {
      const parsed = JSON.parse(body) as CompatRequestBody;
      if (Array.isArray(parsed.messages)) {
        let touched = false;
        parsed.messages = parsed.messages.map((message) => {
          if (message && message.role === 'developer') {
            touched = true;
            return { ...message, role: 'system' };
          }
          return message;
        });
        if (touched) body = JSON.stringify(parsed);
      }
    } catch {
      // body is not JSON, leave as-is
    }
    return fetch(input, { ...init, body });
  };
}

function isOfficialOpenAIBaseURL(baseURL: string): boolean {
  try {
    const url = new URL(baseURL);
    return url.hostname.toLowerCase() === 'api.openai.com';
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
