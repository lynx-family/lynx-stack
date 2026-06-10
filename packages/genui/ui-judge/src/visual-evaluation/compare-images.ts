// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import sharp from 'sharp';

import type { CompareResult, VisualEvaluationCompareOptions } from './types.js';

const DEFAULT_COMPARE_OPTIONS = {
  blockSize: 32,
  pixelTolerance: 0.1,
  threshold: 0.1,
} satisfies Required<VisualEvaluationCompareOptions>;

export interface CompareImagesOptions extends VisualEvaluationCompareOptions {
  outputPath: string;
}

interface RawRgbaImage {
  data: Buffer;
  height: number;
  width: number;
}

export async function compareImages(
  referencePath: string,
  devicePath: string,
  options: CompareImagesOptions,
): Promise<CompareResult> {
  const [referenceMetadata, deviceMetadata] = await Promise.all([
    sharp(referencePath).metadata(),
    sharp(devicePath).metadata(),
  ]);
  const width = Math.min(
    referenceMetadata.width ?? 0,
    deviceMetadata.width ?? 0,
  );
  const height = Math.min(
    referenceMetadata.height ?? 0,
    deviceMetadata.height ?? 0,
  );

  if (width <= 0 || height <= 0) {
    throw new Error('Comparison images must have positive dimensions.');
  }

  const [reference, device] = await Promise.all([
    toRawRgbaImage(referencePath, width, height),
    toRawRgbaImage(devicePath, width, height),
  ]);

  const blockSize = Math.max(
    1,
    Math.round(options.blockSize ?? DEFAULT_COMPARE_OPTIONS.blockSize),
  );
  const threshold = options.threshold ?? DEFAULT_COMPARE_OPTIONS.threshold;
  const pixelTolerance = options.pixelTolerance
    ?? DEFAULT_COMPARE_OPTIONS.pixelTolerance;
  const blockColumns = Math.ceil(width / blockSize);
  const blockRows = Math.ceil(height / blockSize);
  const blockStats = Array.from(
    { length: blockColumns * blockRows },
    () => ({ differentPixels: 0, pixels: 0 }),
  );
  const diffData = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const distance = getNormalizedRgbaDistance(
        reference.data,
        device.data,
        index,
      );
      const blockIndex = Math.floor(y / blockSize) * blockColumns
        + Math.floor(x / blockSize);
      const block = blockStats[blockIndex];
      if (!block) continue;

      block.pixels++;
      if (distance > pixelTolerance) {
        block.differentPixels++;
        diffData[index] = 255;
        diffData[index + 1] = 0;
        diffData[index + 2] = 0;
        diffData[index + 3] = 255;
        continue;
      }

      diffData[index] = device.data[index] ?? 0;
      diffData[index + 1] = device.data[index + 1] ?? 0;
      diffData[index + 2] = device.data[index + 2] ?? 0;
      diffData[index + 3] = device.data[index + 3] ?? 255;
    }
  }

  const diffBlocksData: CompareResult['diffBlocksData'] = [];
  for (let blockY = 0; blockY < blockRows; blockY++) {
    for (let blockX = 0; blockX < blockColumns; blockX++) {
      const block = blockStats[blockY * blockColumns + blockX];
      if (!block || block.pixels === 0) continue;

      const diffRatio = block.differentPixels / block.pixels;
      if (diffRatio > threshold) {
        diffBlocksData.push({
          diffRatio,
          x: blockX * blockSize,
          y: blockY * blockSize,
        });
      }
    }
  }

  await sharp(diffData, {
    raw: {
      channels: 4,
      height,
      width,
    },
  })
    .png()
    .toFile(options.outputPath);

  const totalBlocks = blockColumns * blockRows;
  const differentBlocks = diffBlocksData.length;

  return {
    diffBlocksData,
    differentBlocks,
    height,
    similarity: totalBlocks === 0
      ? 1
      : Math.max(0, Math.min(1, 1 - differentBlocks / totalBlocks)),
    totalBlocks,
    width,
  };
}

async function toRawRgbaImage(
  path: string,
  width: number,
  height: number,
): Promise<RawRgbaImage> {
  const { data, info } = await sharp(path)
    .resize({ fit: 'fill', height, width })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    data,
    height: info.height,
    width: info.width,
  };
}

function getNormalizedRgbaDistance(
  reference: Buffer,
  device: Buffer,
  index: number,
): number {
  let sumSquares = 0;
  for (let channel = 0; channel < 4; channel++) {
    const delta = (reference[index + channel] ?? 0)
      - (device[index + channel] ?? 0);
    sumSquares += delta * delta;
  }

  return Math.sqrt(sumSquares) / Math.sqrt(4 * 255 * 255);
}
