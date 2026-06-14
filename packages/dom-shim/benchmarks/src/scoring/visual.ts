// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';

import Anthropic from '@anthropic-ai/sdk';

/**
 * Visual similarity scorer for Phase 1 benchmark (PRD US-108 + RUBRIC.md M4).
 *
 * Sends a screenshot + the original prompt text to Claude vision (Opus 4.7 by
 * default per OQ-8). The model returns JSON `{score: 0..5 integer, rationale}`,
 * which we normalize to 0..1.
 *
 * Without ANTHROPIC_API_KEY (or with the vision backend explicitly disabled),
 * the scorer is a soft no-op: returns `{score: null, rationale: '...'}`. M1/M2/
 * M3 stay meaningful; M4 is omitted from the aggregate.
 *
 * Results are cached on disk keyed by `${sha256(screenshot)}::${prompt_id}` so
 * repeated benchmark runs are cheap.
 */

export interface VisualScoreResult {
  score: number | null;
  rationale: string;
}

interface CacheEntry {
  score: number | null;
  rationale: string;
  model_id: string;
  scored_at: string;
}

type Cache = Record<string, CacheEntry>;

interface ScoreOptions {
  screenshotPath: string;
  promptText: string;
  promptId: string;
  modelId: string;
  cachePath: string;
}

const VISION_SYSTEM_PROMPT =
  `Rate from 0 to 5 how well this screenshot matches the prompt description.
Consider:
  - presence of the described UI elements
  - basic layout correctness
  - visual quality and polish
Return JSON: {"score": <0..5 integer>, "rationale": "<one short sentence>"}.`;

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (client) return client;
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) return null;
  client = new Anthropic({ apiKey });
  return client;
}

function loadCache(cachePath: string): Cache {
  if (!existsSync(cachePath)) return {};
  try {
    return JSON.parse(readFileSync(cachePath, 'utf8')) as Cache;
  } catch {
    return {};
  }
}

function saveCache(cachePath: string, cache: Cache): void {
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, JSON.stringify(cache, null, 2));
}

function cacheKeyOf(screenshotBytes: Buffer, promptId: string): string {
  const sha = createHash('sha256').update(screenshotBytes).digest('hex').slice(
    0,
    16,
  );
  return `${sha}::${promptId}`;
}

function detectMimeType(path: string): 'image/png' | 'image/jpeg' {
  return path.toLowerCase().endsWith('.jpg')
      || path.toLowerCase().endsWith('.jpeg')
    ? 'image/jpeg'
    : 'image/png';
}

interface ParsedScore {
  score: number;
  rationale: string;
}

function parseScoreReply(text: string): ParsedScore | null {
  const match = /\{[\s\S]*?"score"[\s\S]*?\}/.exec(text);
  if (!match?.[0]) return null;
  try {
    const obj = JSON.parse(match[0]) as {
      score?: unknown;
      rationale?: unknown;
    };
    const rawScore = typeof obj.score === 'number'
      ? obj.score
      : (typeof obj.score === 'string'
        ? Number(obj.score)
        : Number.NaN);
    if (!Number.isFinite(rawScore) || rawScore < 0 || rawScore > 5) return null;
    return {
      score: rawScore,
      rationale: typeof obj.rationale === 'string' ? obj.rationale : '',
    };
  } catch {
    return null;
  }
}

export async function scoreVisualSimilarity(
  opts: ScoreOptions,
): Promise<VisualScoreResult> {
  if (!existsSync(opts.screenshotPath)) {
    return {
      score: null,
      rationale: `screenshot not found at ${opts.screenshotPath}`,
    };
  }
  const c = getClient();
  if (!c) {
    return {
      score: null,
      rationale: 'no ANTHROPIC_API_KEY — visual scoring skipped',
    };
  }

  const bytes = readFileSync(opts.screenshotPath);
  const key = cacheKeyOf(bytes, opts.promptId);
  const cache = loadCache(opts.cachePath);
  const cached = cache[key];
  if (cached) {
    return { score: cached.score, rationale: cached.rationale };
  }

  const resp = await c.messages.create({
    model: opts.modelId,
    max_tokens: 256,
    system: VISION_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: detectMimeType(opts.screenshotPath),
              data: bytes.toString('base64'),
            },
          },
          {
            type: 'text',
            text: `Prompt: ${opts.promptText}`,
          },
        ],
      },
    ],
  });

  let replyText = '';
  for (const block of resp.content) {
    if (block.type === 'text') replyText += block.text;
  }

  const parsed = parseScoreReply(replyText);
  if (!parsed) {
    return {
      score: null,
      rationale: `vision response did not parse as {score, rationale}: ${
        replyText.slice(0, 200)
      }`,
    };
  }

  const normalized = parsed.score / 5;
  const result: VisualScoreResult = {
    score: normalized,
    rationale: parsed.rationale,
  };
  cache[key] = {
    score: normalized,
    rationale: parsed.rationale,
    model_id: opts.modelId,
    scored_at: new Date().toISOString(),
  };
  saveCache(opts.cachePath, cache);
  return result;
}

export function defaultVisualCachePath(): string {
  return resolvePath(
    process.cwd(),
    'packages/dom-shim/benchmarks/cache/visual-scores.json',
  );
}
