// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import sharp from 'sharp';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  VISUAL_EVALUATION_SYSTEM_PROMPT,
  VISUAL_EVALUATION_USER_PROMPT,
  evaluateImagesWithMidscene,
  runVisualEvaluation,
} from '../src/index.js';

const midsceneMock = vi.hoisted(() => ({
  aiString: vi.fn<(...args: unknown[]) => Promise<string>>(),
  constructorOptions: [] as unknown[],
  destroy: vi.fn<() => Promise<void>>(),
  pages: [] as unknown[],
}));

vi.mock('@midscene/core/agent', () => {
  class Agent {
    aiString = midsceneMock.aiString;
    destroy = midsceneMock.destroy;

    constructor(page: unknown, options: unknown) {
      midsceneMock.pages.push(page);
      midsceneMock.constructorOptions.push(options);
    }
  }

  return { Agent };
});

describe('evaluateImagesWithMidscene', () => {
  beforeEach(() => {
    midsceneMock.aiString.mockReset();
    midsceneMock.aiString.mockResolvedValue(JSON.stringify({
      extra: 'preserved',
      issues: [],
      reason: 'midscene ok',
      score: 0.73,
      summary: 'The rendered image is close to the reference.',
    }));
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

    expect(midsceneMock.aiString).toHaveBeenCalledTimes(1);
    const [prompt, options] = midsceneMock.aiString.mock.calls[0] as [
      {
        images: Array<{ name: string; url: string }>;
        prompt: string;
      },
      unknown,
    ];
    expect(typeof prompt).toBe('object');
    expect(prompt).toEqual({
      images: [
        {
          name: 'reference_image',
          url: referenceImageDataUrl,
        },
        {
          name: 'rendered_image',
          url: renderedImageDataUrl,
        },
      ],
      prompt:
        `${VISUAL_EVALUATION_SYSTEM_PROMPT}\n\n${VISUAL_EVALUATION_USER_PROMPT}`,
    });
    expect(options).toEqual({
      domIncluded: false,
      screenshotIncluded: false,
    });
    expect(midsceneMock.destroy).toHaveBeenCalledTimes(1);
  });

  it('runs the visual evaluation pipeline into Midscene by default', async () => {
    const referenceImage = await createPngBuffer({ blue: 32 });
    const deviceImage = await createPngBuffer({ blue: 224 });
    const capture = vi.fn().mockResolvedValue(deviceImage.toString('base64'));

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

    expect(midsceneMock.aiString).toHaveBeenCalledTimes(1);
    const [prompt] = midsceneMock.aiString.mock.calls[0] as [
      {
        images: Array<{ name: string; url: string }>;
        prompt: string;
      },
    ];
    expect(prompt.prompt).toBe(
      `${VISUAL_EVALUATION_SYSTEM_PROMPT}\n\n${VISUAL_EVALUATION_USER_PROMPT}`,
    );
    expect(prompt.images).toHaveLength(2);
    expect(prompt.images[0]?.name).toBe('reference_image');
    expect(prompt.images[0]?.url).toMatch(/^data:image\/png;base64,/);
    expect(prompt.images[1]?.name).toBe('rendered_image');
    expect(prompt.images[1]?.url).toMatch(/^data:image\/png;base64,/);
  });
});

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
