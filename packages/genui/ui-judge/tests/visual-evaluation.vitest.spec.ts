// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { readFile } from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runVisualEvaluation } from '../src/index.js';
import type { VisualEvaluationRequest } from '../src/index.js';

const MOCK_MODEL_RESPONSE = JSON.stringify({
  extra: 'preserved',
  issues: [
    {
      category: 'layout',
      description: 'The rendered screenshot is visually aligned.',
      severity: 'low',
    },
  ],
  reason: 'mocked evaluation',
  score: 0.91,
  summary: 'The render is close to the reference.',
});

describe('runVisualEvaluation', () => {
  let previousMockResponse: string | undefined;

  beforeEach(() => {
    previousMockResponse = process.env['UI_JUDGE_MODEL_RESPONSE_JSON'];
    process.env['UI_JUDGE_MODEL_RESPONSE_JSON'] = MOCK_MODEL_RESPONSE;
  });

  afterEach(() => {
    if (previousMockResponse === undefined) {
      delete process.env['UI_JUDGE_MODEL_RESPONSE_JSON'];
    } else {
      process.env['UI_JUDGE_MODEL_RESPONSE_JSON'] = previousMockResponse;
    }
  });

  it('delegates screenshot evaluation to the Rust UI Judge implementation', async () => {
    const image = await fixtureImageBase64();
    const result = await runVisualEvaluation({
      referenceImage: image,
      renderedImage: image,
    });

    expect(result).toMatchObject({
      ok: true,
      reason: 'mocked evaluation',
      score: 0.91,
    });
    expect(result.artifacts.referenceImageBase64).toBeTruthy();
    expect(result.artifacts.renderedImageBase64).toBeTruthy();
    expect(result.artifacts.alignedReferenceImageBase64).toBeTruthy();
    expect(result.artifacts.alignedRenderedImageBase64).toBeTruthy();
    expect(result.artifacts.diffImageBase64).toBeTruthy();
    expect(result.metrics.compareResult.similarity).toBeGreaterThanOrEqual(0);
    expect(result.metrics.evaluationResult).toMatchObject({
      extra: 'preserved',
      reason: 'mocked evaluation',
      score: 0.91,
    });
  });

  it('accepts data URL screenshots', async () => {
    const image = await fixtureImageBase64();
    const result = await runVisualEvaluation({
      referenceImage: `data:image/png;base64,${image}`,
      renderedImage: `data:image/png;base64,${image}`,
    });

    expect(result.score).toBe(0.91);
  });

  it('rejects invalid request bodies with Rust error codes', async () => {
    await expect(runVisualEvaluation({} as VisualEvaluationRequest)).rejects
      .toMatchObject({
        code: 'INVALID_REQUEST',
        status: 400,
      });
  });

  it('rejects unreadable rendered images with Rust error codes', async () => {
    const image = await fixtureImageBase64();
    await expect(
      runVisualEvaluation({
        referenceImage: image,
        renderedImage: 'not-an-image',
      }),
    ).rejects.toMatchObject({
      code: 'RENDERED_IMAGE_INVALID',
      status: 400,
    });
  });

  it('rejects legacy TypeScript evaluation hooks', async () => {
    const image = await fixtureImageBase64();
    await expect(
      runVisualEvaluation(
        {
          referenceImage: image,
          renderedImage: image,
        },
        {
          evaluate: async () => ({ score: 1 }),
        } as never,
      ),
    ).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
      status: 400,
    });
  });
});

async function fixtureImageBase64(): Promise<string> {
  const image = await readFile(
    new URL('./fixtures/react/src/assets/arrow.png', import.meta.url),
  );
  return image.toString('base64');
}
