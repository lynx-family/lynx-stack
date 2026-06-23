// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  VISUAL_EVALUATION_SYSTEM_PROMPT,
  VISUAL_EVALUATION_USER_PROMPT,
  normalizeEvaluationResult,
  runVisualEvaluation,
} from '../src/index.js';
import type { EvaluateFn, VisualEvaluationRequest } from '../src/index.js';

describe('runVisualEvaluation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('evaluates base64 screenshots and returns artifacts', async () => {
    const reference = await createPatternPng();
    const rendered = await createPatternPng();
    const evaluate = createEvaluate({
      extra: 'preserved',
      issues: [],
      reason: 'mocked evaluation',
      score: 0.91,
      summary: 'The render is close.',
    });

    const result = await runVisualEvaluation(
      {
        referenceImage: reference.toString('base64'),
        renderedImage: rendered.toString('base64'),
      },
      { evaluate },
    );

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
    expect(evaluate).toHaveBeenCalledWith(
      expect.stringMatching(/^data:image\/png;base64,/),
      expect.stringMatching(/^data:image\/png;base64,/),
      undefined,
    );
  });

  it('accepts data URL screenshots', async () => {
    const reference = await createPatternPng();
    const rendered = await createPatternPng();
    const result = await runVisualEvaluation(
      {
        referenceImage: `data:image/png;base64,${reference.toString('base64')}`,
        renderedImage: `data:image/png;base64,${rendered.toString('base64')}`,
      },
      { evaluate: createEvaluate({ reason: 'ok', score: 1 }) },
    );

    expect(result.score).toBe(1);
  });

  it('fetches HTTP and HTTPS screenshots', async () => {
    const reference = await createPatternPng();
    const rendered = await createPatternPng({ invert: true });
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(reference, { status: 200 }))
      .mockResolvedValueOnce(new Response(rendered, { status: 200 }));

    const result = await runVisualEvaluation(
      {
        referenceImage: 'http://example.com/reference.png',
        renderedImage: 'https://example.com/rendered.png',
      },
      {
        evaluate: createEvaluate({ reason: 'ok', score: 0.9 }),
        fetch: fetchMock,
      },
    );

    expect(result.score).toBe(0.9);
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('http://example.com/reference.png'),
      expect.objectContaining({ redirect: 'error' }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://example.com/rendered.png'),
      expect.objectContaining({ redirect: 'error' }),
    );
  });

  it('rejects invalid request bodies', async () => {
    await expect(runVisualEvaluation({} as VisualEvaluationRequest)).rejects
      .toMatchObject({
        code: 'INVALID_REQUEST',
        status: 400,
      });
  });

  it('rejects unreadable reference images', async () => {
    const rendered = await createPatternPng();
    await expect(
      runVisualEvaluation({
        referenceImage: 'not-an-image',
        renderedImage: rendered.toString('base64'),
      }),
    ).rejects.toMatchObject({
      code: 'REFERENCE_IMAGE_INVALID',
      status: 400,
    });
  });

  it('rejects unreadable rendered images', async () => {
    const reference = await createPatternPng();
    await expect(
      runVisualEvaluation({
        referenceImage: reference.toString('base64'),
        renderedImage: 'not-an-image',
      }),
    ).rejects.toMatchObject({
      code: 'RENDERED_IMAGE_INVALID',
      status: 400,
    });
  });

  it('maps reference fetch failures', async () => {
    const rendered = await createPatternPng();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('', { status: 404 }),
    );

    await expect(
      runVisualEvaluation(
        {
          referenceImage: 'https://example.com/missing.png',
          renderedImage: rendered.toString('base64'),
        },
        { fetch: fetchMock },
      ),
    ).rejects.toMatchObject({
      code: 'REFERENCE_IMAGE_FETCH_FAILED',
      status: 502,
    });
  });

  it('maps rendered fetch failures', async () => {
    const reference = await createPatternPng();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('', { status: 404 }),
    );

    await expect(
      runVisualEvaluation(
        {
          referenceImage: reference.toString('base64'),
          renderedImage: 'https://example.com/missing.png',
        },
        { fetch: fetchMock },
      ),
    ).rejects.toMatchObject({
      code: 'RENDERED_IMAGE_FETCH_FAILED',
      status: 502,
    });
  });

  it('rejects oversized image responses', async () => {
    const rendered = await createPatternPng();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('', {
        headers: {
          'Content-Length': String(11 * 1024 * 1024),
          'Content-Type': 'image/png',
        },
        status: 200,
      }),
    );

    await expect(
      runVisualEvaluation(
        {
          referenceImage: 'https://example.com/large.png',
          renderedImage: rendered.toString('base64'),
        },
        { fetch: fetchMock },
      ),
    ).rejects.toMatchObject({
      code: 'REFERENCE_IMAGE_FETCH_FAILED',
      status: 502,
    });
  });

  it('rejects non-image responses', async () => {
    const rendered = await createPatternPng();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{}', {
        headers: {
          'Content-Type': 'application/json',
        },
        status: 200,
      }),
    );

    await expect(
      runVisualEvaluation(
        {
          referenceImage: 'https://example.com/reference.json',
          renderedImage: rendered.toString('base64'),
        },
        { fetch: fetchMock },
      ),
    ).rejects.toMatchObject({
      code: 'REFERENCE_IMAGE_FETCH_FAILED',
      status: 502,
    });
  });

  it.each([
    {
      field: 'compareOptions.blockSize',
      request: {
        compareOptions: { blockSize: 1.5 },
        referenceImage: 'abc',
        renderedImage: 'abc',
      },
    },
  ])('rejects non-integer $field', async ({ request }) => {
    await expect(
      runVisualEvaluation(request as VisualEvaluationRequest),
    ).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
      status: 400,
    });
  });

  it('falls back to original images when alignment confidence is too low', async () => {
    const reference = await createPatternPng();
    const rendered = await createPatternPng({ invert: true });
    const result = await runVisualEvaluation(
      {
        alignOptions: {
          minScore: 2,
        },
        referenceImage: reference.toString('base64'),
        renderedImage: rendered.toString('base64'),
      },
      {
        evaluate: createEvaluate({ reason: 'ok', score: 0.5 }),
      },
    );

    expect(result.metrics.alignResult).toBeNull();
    expect(result.warnings).toContain(
      'Image alignment confidence too low; compared original images.',
    );
    expect(result.artifacts.diffImageBase64).toBeTruthy();
  });

  it('maps evaluation failures', async () => {
    const reference = await createPatternPng();
    const rendered = await createPatternPng();
    await expect(
      runVisualEvaluation(
        {
          referenceImage: reference.toString('base64'),
          renderedImage: rendered.toString('base64'),
        },
        {
          evaluate: () => {
            throw new Error('model failed');
          },
        },
      ),
    ).rejects.toMatchObject({
      code: 'EVALUATION_API_ERROR',
      status: 502,
    });
  });

  it('requires reason and summary when normalizing evaluation results', () => {
    expect(() =>
      normalizeEvaluationResult({
        issues: [],
        score: 0.5,
        summary: 'Missing reason.',
      })
    ).toThrowError(/reason/);
    expect(() =>
      normalizeEvaluationResult({
        issues: [],
        reason: 'Missing summary.',
        score: 0.5,
      })
    ).toThrowError(/summary/);
  });

  it('filters evaluation issues to the prompt category contract', () => {
    const result = normalizeEvaluationResult({
      issues: [
        {
          category: 'layout',
          description: 'Main card is shifted.',
          severity: 'medium',
        },
        {
          category: 'unknown',
          description: 'Unknown categories should not leak through.',
          severity: 'high',
        },
      ],
      reason: 'The render mostly matches.',
      score: 0.75,
      summary: 'Only contract-compliant issues are returned.',
    });

    expect(result.issues).toEqual([
      {
        category: 'layout',
        description: 'Main card is shifted.',
        severity: 'medium',
      },
    ]);
  });

  it('exports the scoring prompts', () => {
    expect(VISUAL_EVALUATION_SYSTEM_PROMPT).toContain(
      'strict visual quality evaluator',
    );
    expect(VISUAL_EVALUATION_USER_PROMPT).toContain(
      'Screenshot capture noise',
    );
  });
});

function createEvaluate(result: Record<string, unknown>): EvaluateFn {
  return vi.fn<EvaluateFn>().mockResolvedValue({
    issues: [],
    reason: 'ok',
    score: 1,
    summary: 'The render matches.',
    ...result,
  });
}

async function createPatternPng(
  options: { invert?: boolean } = {},
): Promise<Buffer> {
  const width = 64;
  const height = 64;
  const data = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const isDark = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0;
      const isInverted = options.invert === true;
      const value = isDark === isInverted ? 224 : 32;
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = 255;
    }
  }

  return await sharp(data, {
    raw: {
      channels: 4,
      height,
      width,
    },
  }).png().toBuffer();
}
