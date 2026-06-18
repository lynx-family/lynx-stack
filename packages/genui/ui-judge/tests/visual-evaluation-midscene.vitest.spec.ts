// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { callAIWithStringResponse } from '@midscene/core/ai-model';
import type { ChatCompletionMessageParam } from '@midscene/core/ai-model';
import { beforeEach, describe, expect, it, rstest } from '@rstest/core';
import sharp from 'sharp';

import {
  VISUAL_EVALUATION_SYSTEM_PROMPT,
  VISUAL_EVALUATION_USER_PROMPT,
  evaluateImagesWithMidscene,
  runVisualEvaluation,
} from '../src/index.js';

const midsceneMock = rstest.hoisted(() => ({
  callAIWithStringResponse: rstest.fn<
    (...args: unknown[]) => Promise<{ content: string }>
  >(),
  constructorOptions: [] as unknown[],
  destroy: rstest.fn<() => Promise<void>>(),
  pages: [] as unknown[],
}));

interface ImageMessagePart {
  image_url: {
    url: string;
  };
  type: 'image_url';
}

rstest.mock('@midscene/core/ai-model', () => {
  return {
    callAIWithStringResponse: midsceneMock.callAIWithStringResponse,
  };
});

rstest.mock('@midscene/core/agent', () => {
  class Agent {
    destroy = midsceneMock.destroy;
    modelConfigManager = {
      getModelConfig: rstest.fn(() => ({ modelName: 'mock-model' })),
    };

    constructor(page: unknown, options: unknown) {
      midsceneMock.pages.push(page);
      midsceneMock.constructorOptions.push(options);
    }
  }

  return { Agent };
});

describe('evaluateImagesWithMidscene', () => {
  beforeEach(() => {
    midsceneMock.callAIWithStringResponse.mockReset();
    midsceneMock.callAIWithStringResponse.mockResolvedValue({
      content: JSON.stringify({
        extra: 'preserved',
        issues: [],
        reason: 'midscene ok',
        score: 0.73,
        summary: 'The rendered image is close to the reference.',
      }),
    });
    midsceneMock.destroy.mockReset();
    midsceneMock.destroy.mockResolvedValue(undefined);
    midsceneMock.constructorOptions.length = 0;
    midsceneMock.pages.length = 0;
  });

  it('calls Midscene with image-capable prompt input', async () => {
    const referenceImageDataUrl = await createDataUrl({ blue: 32 });
    const renderedImageDataUrl = await createDataUrl({ blue: 224 });

    const result = await evaluateImagesWithMidscene(
      referenceImageDataUrl,
      renderedImageDataUrl,
    );

    expect(result).toMatchObject({
      extra: 'preserved',
      reason: 'midscene ok',
      score: 0.73,
      summary: 'The rendered image is close to the reference.',
    });
    expect(midsceneMock.constructorOptions[0]).toEqual({
      autoPrintReportMsg: false,
      generateReport: false,
    });

    const page = midsceneMock.pages[0] as {
      actionSpace(): unknown[];
      describe(): string;
      interfaceType: string;
      screenshotBase64(): Promise<string>;
      size(): Promise<{ height: number; width: number }>;
    };
    expect(page.interfaceType).toBe('static');
    expect(page.actionSpace()).toEqual([]);
    expect(page.describe()).toBe('visual-evaluation static rendered image');
    await expect(page.screenshotBase64()).resolves.toBe(renderedImageDataUrl);
    await expect(page.size()).resolves.toEqual({ height: 8, width: 8 });

    expect(callAIWithStringResponse).toBe(
      midsceneMock.callAIWithStringResponse,
    );
    expect(midsceneMock.callAIWithStringResponse).toHaveBeenCalledTimes(1);
    const [messages, modelConfig] = midsceneMock.callAIWithStringResponse.mock
      .calls[0] as [
        ChatCompletionMessageParam[],
        unknown,
      ];
    expect(modelConfig).toEqual({ modelName: 'mock-model' });
    expect(messages).toEqual([
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
    ]);
    expect(
      JSON.stringify(messages),
    ).toContain(referenceImageDataUrl);
    expect(
      JSON.stringify(messages),
    ).toContain(renderedImageDataUrl);
    expect(midsceneMock.destroy).toHaveBeenCalledTimes(1);
  });

  it('runs the visual evaluation pipeline into Midscene by default', async () => {
    const referenceImage = await createPngBuffer({ blue: 32 });
    const deviceImage = await createPngBuffer({ blue: 224 });
    const capture = rstest.fn().mockResolvedValue(
      deviceImage.toString('base64'),
    );

    const result = await runVisualEvaluation(
      {
        alignOptions: {
          minScore: 2,
        },
        referenceImage: referenceImage.toString('base64'),
        templateUrl: 'http://localhost/template.html',
      },
      { capture },
    );

    expect(result).toMatchObject({
      ok: true,
      reason: 'midscene ok',
      score: 0.73,
    });
    expect(capture).toHaveBeenCalledWith({
      targetPageUrl: 'http://localhost/template.html',
    });

    expect(midsceneMock.callAIWithStringResponse).toHaveBeenCalledTimes(1);
    const [messages] = midsceneMock.callAIWithStringResponse.mock.calls[0] as [
      ChatCompletionMessageParam[],
    ];
    expect(messages[0]).toMatchObject({
      content: VISUAL_EVALUATION_SYSTEM_PROMPT,
      role: 'system',
    });
    const userContent = messages[1]?.content;
    expect(Array.isArray(userContent)).toBe(true);
    const imageParts = Array.isArray(userContent)
      ? userContent.filter((part) => isImageMessagePart(part))
      : [];
    expect(imageParts).toHaveLength(2);
    expect(imageParts[0]?.type).toBe('image_url');
    expect(imageParts[0]?.image_url.url).toMatch(
      /^data:image\/png;base64,/,
    );
    expect(imageParts[1]?.type).toBe('image_url');
    expect(imageParts[1]?.image_url.url).toMatch(
      /^data:image\/png;base64,/,
    );
  });
});

function isImageMessagePart(value: unknown): value is ImageMessagePart {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const imageUrl = candidate['image_url'];
  return candidate['type'] === 'image_url'
    && typeof imageUrl === 'object'
    && imageUrl !== null
    && !Array.isArray(imageUrl)
    && typeof (imageUrl as Record<string, unknown>)['url'] === 'string';
}

async function createDataUrl(options: { blue: number }): Promise<string> {
  const buffer = await createPngBuffer({
    blue: options.blue,
    height: 8,
    width: 8,
  });
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

async function createPngBuffer(
  options: { blue: number; height?: number; width?: number },
): Promise<Buffer> {
  const width = 8;
  const height = 8;
  const actualWidth = options.width ?? width;
  const actualHeight = options.height ?? height;
  const data = Buffer.alloc(actualWidth * actualHeight * 4);
  for (let index = 0; index < data.length; index += 4) {
    data[index] = 48;
    data[index + 1] = 96;
    data[index + 2] = options.blue;
    data[index + 3] = 255;
  }

  const buffer = await sharp(data, {
    raw: {
      channels: 4,
      height: actualHeight,
      width: actualWidth,
    },
  }).png().toBuffer();
  return buffer;
}
