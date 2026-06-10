// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';

import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  VISUAL_EVALUATION_SYSTEM_PROMPT,
  VISUAL_EVALUATION_USER_PROMPT,
  createVisualEvaluationServer,
  runVisualEvaluation,
} from '../src/index.js';
import type {
  CaptureFn,
  EvaluateFn,
  VisualEvaluationRequest,
} from '../src/index.js';

describe('runVisualEvaluation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('evaluates a plain base64 reference image and returns artifacts', async () => {
    const reference = await createPatternPng();
    const capture = createCapture(reference);
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
        templateUrl: 'http://localhost/render.html',
      },
      { capture, evaluate },
    );

    expect(result).toMatchObject({
      ok: true,
      reason: 'mocked evaluation',
      score: 0.91,
    });
    expect(result.artifacts.referenceImageBase64).toBeTruthy();
    expect(result.artifacts.deviceImageBase64).toBeTruthy();
    expect(result.artifacts.alignedReferenceImageBase64).toBeTruthy();
    expect(result.artifacts.alignedDeviceImageBase64).toBeTruthy();
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
    );
    expect(capture).toHaveBeenCalledWith({
      targetPageUrl: 'http://localhost/render.html',
    });
  });

  it('accepts a data URL reference image', async () => {
    const reference = await createPatternPng();
    const result = await runVisualEvaluation(
      {
        referenceImage: `data:image/png;base64,${reference.toString('base64')}`,
        templateUrl: 'http://localhost/render.html',
      },
      {
        capture: createCapture(reference),
        evaluate: createEvaluate({ reason: 'ok', score: 1 }),
      },
    );

    expect(result.score).toBe(1);
  });

  it('fetches an HTTP reference image', async () => {
    const reference = await createPatternPng();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(reference, { status: 200 }),
    );

    const result = await runVisualEvaluation(
      {
        referenceImage: 'http://example.com/reference.png',
        templateUrl: 'http://localhost/render.html',
      },
      {
        capture: createCapture(reference),
        evaluate: createEvaluate({ reason: 'ok', score: 0.9 }),
        fetch: fetchMock,
      },
    );

    expect(result.score).toBe(0.9);
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('http://example.com/reference.png'),
    );
  });

  it('fetches an HTTPS reference image', async () => {
    const reference = await createPatternPng();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(reference, { status: 200 }),
    );

    const result = await runVisualEvaluation(
      {
        referenceImage: 'https://example.com/reference.png',
        templateUrl: 'http://localhost/render.html',
      },
      {
        capture: createCapture(reference),
        evaluate: createEvaluate({ reason: 'ok', score: 0.9 }),
        fetch: fetchMock,
      },
    );

    expect(result.score).toBe(0.9);
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://example.com/reference.png'),
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
    await expect(
      runVisualEvaluation({
        referenceImage: 'not-an-image',
        templateUrl: 'http://localhost/render.html',
      }),
    ).rejects.toMatchObject({
      code: 'REFERENCE_IMAGE_INVALID',
      status: 400,
    });
  });

  it('maps reference fetch failures', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('', { status: 404 }),
    );

    await expect(
      runVisualEvaluation(
        {
          referenceImage: 'https://example.com/missing.png',
          templateUrl: 'http://localhost/render.html',
        },
        { fetch: fetchMock },
      ),
    ).rejects.toMatchObject({
      code: 'REFERENCE_IMAGE_FETCH_FAILED',
      status: 502,
    });
  });

  it('maps capture failures', async () => {
    const reference = await createPatternPng();
    await expect(
      runVisualEvaluation(
        {
          referenceImage: reference.toString('base64'),
          templateUrl: 'http://localhost/render.html',
        },
        {
          capture: () => {
            throw new Error('capture failed');
          },
          evaluate: createEvaluate({ reason: 'unused', score: 0 }),
        },
      ),
    ).rejects.toMatchObject({
      code: 'CAPTURE_UPSTREAM_ERROR',
      status: 502,
    });
  });

  it('maps empty capture results', async () => {
    const reference = await createPatternPng();
    await expect(
      runVisualEvaluation(
        {
          referenceImage: reference.toString('base64'),
          templateUrl: 'http://localhost/render.html',
        },
        {
          capture: () => Promise.resolve(undefined),
          evaluate: createEvaluate({ reason: 'unused', score: 0 }),
        },
      ),
    ).rejects.toMatchObject({
      code: 'CAPTURE_EMPTY_RESULT',
      status: 502,
    });
  });

  it('forwards template URL, trace ID, and capture options', async () => {
    const reference = await createPatternPng();
    const capture = createCapture(reference);
    await runVisualEvaluation(
      {
        capture: {
          maxRetry: 3,
          silent: true,
          waitTimeMs: 250,
        },
        referenceImage: reference.toString('base64'),
        templateUrl: 'http://localhost/render.html?case=forward',
        traceId: 'trace-forwarding',
      },
      {
        capture,
        evaluate: createEvaluate({ reason: 'ok', score: 1 }),
      },
    );

    expect(capture).toHaveBeenCalledWith({
      maxRetry: 3,
      silent: true,
      targetPageUrl: 'http://localhost/render.html?case=forward',
      traceId: 'trace-forwarding',
      waitTimeMs: 250,
    });
  });

  it('falls back to original images when alignment confidence is too low', async () => {
    const reference = await createPatternPng();
    const result = await runVisualEvaluation(
      {
        alignOptions: {
          minScore: 2,
        },
        referenceImage: reference.toString('base64'),
        templateUrl: 'http://localhost/render.html',
      },
      {
        capture: createCapture(await createPatternPng({ invert: true })),
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
    await expect(
      runVisualEvaluation(
        {
          referenceImage: reference.toString('base64'),
          templateUrl: 'http://localhost/render.html',
        },
        {
          capture: createCapture(reference),
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

  it('exports the scoring prompts verbatim', () => {
    expect(VISUAL_EVALUATION_SYSTEM_PROMPT).toBe(
      `You are a strict visual quality evaluator for UI implementation fidelity.

You compare two UI screenshots:
1. reference_image: the target visual baseline
2. rendered_image: the implementation screenshot

Your job is to judge how closely rendered_image matches reference_image.
Evaluate only visual fidelity. Do not judge code quality, implementation method, accessibility, or product semantics unless they visibly affect the screenshot.

Return valid JSON only. Do not wrap the JSON in markdown. Do not include comments.`,
    );
    expect(VISUAL_EVALUATION_USER_PROMPT).toBe(
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
- Do not invent hidden or non-visible differences.`,
    );
  });
});

describe('visual evaluation HTTP server', () => {
  it('returns INVALID_JSON for malformed JSON', async () => {
    await withVisualEvaluationServer({}, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/visual-evaluation`, {
        body: '{"templateUrl":',
        method: 'POST',
      });
      await expect(response.json()).resolves.toMatchObject({
        code: 'INVALID_JSON',
        ok: false,
        status: 400,
      });
      expect(response.status).toBe(400);
    });
  });

  it('handles POST /visual-evaluation', async () => {
    const reference = await createPatternPng();
    await withVisualEvaluationServer(
      {
        capture: createCapture(reference),
        evaluate: createEvaluate({ reason: 'server ok', score: 0.88 }),
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/visual-evaluation`, {
          body: JSON.stringify({
            referenceImage: reference.toString('base64'),
            templateUrl: 'http://localhost/render.html',
          }),
          headers: {
            'Content-Type': 'application/json',
          },
          method: 'POST',
        });
        await expect(response.json()).resolves.toMatchObject({
          ok: true,
          reason: 'server ok',
          score: 0.88,
        });
        expect(response.status).toBe(200);
      },
    );
  });
});

function createCapture(image: Buffer): CaptureFn {
  return vi.fn<CaptureFn>().mockResolvedValue(image.toString('base64'));
}

function createEvaluate(result: Record<string, unknown>): EvaluateFn {
  return vi.fn<EvaluateFn>().mockResolvedValue(result);
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
      const value = (isDark !== options.invert) ? 32 : 224;
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

async function withVisualEvaluationServer(
  options: Parameters<typeof createVisualEvaluationServer>[0],
  test: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = createVisualEvaluationServer(options);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  try {
    await test(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}
