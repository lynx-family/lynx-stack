// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import sharp from 'sharp';

import type { AlignResult, VisualEvaluationAlignOptions } from './types.js';

const DEFAULT_ALIGN_OPTIONS = {
  downsampleWidth: 256,
  maxDx: 0,
  maxDyRatio: 0.18,
  minScore: 0.15,
  topSkipRatio: 0.06,
  windowHeightRatio: 0.28,
} satisfies Required<Omit<VisualEvaluationAlignOptions, 'targetWidth'>>;

export interface AlignImagesOptions extends VisualEvaluationAlignOptions {
  outputAlignedDevicePath: string;
  outputAlignedReferencePath: string;
}

interface RawGrayImage {
  channels: number;
  data: Buffer;
  height: number;
  width: number;
}

interface CandidateScore {
  dx: number;
  dy: number;
  score: number;
  windowY: number;
}

export async function alignImages(
  referencePath: string,
  devicePath: string,
  options: AlignImagesOptions,
): Promise<AlignResult | null> {
  const referenceMetadata = await sharp(referencePath).metadata();
  const deviceMetadata = await sharp(devicePath).metadata();
  const referenceWidth = referenceMetadata.width ?? 0;
  const deviceWidth = deviceMetadata.width ?? 0;

  if (referenceWidth <= 0 || deviceWidth <= 0) {
    return null;
  }

  const targetWidth = Math.max(
    1,
    Math.round(options.targetWidth ?? Math.min(referenceWidth, deviceWidth)),
  );
  const downsampleWidth = Math.max(
    1,
    Math.min(
      targetWidth,
      Math.round(options.downsampleWidth ?? DEFAULT_ALIGN_OPTIONS.downsampleWidth),
    ),
  );

  const [resizedReference, resizedDevice] = await Promise.all([
    resizeToWidth(referencePath, targetWidth),
    resizeToWidth(devicePath, targetWidth),
  ]);
  const [downsampledReference, downsampledDevice] = await Promise.all([
    toGrayImage(resizedReference.buffer, downsampleWidth),
    toGrayImage(resizedDevice.buffer, downsampleWidth),
  ]);

  const windowY = selectHighVarianceWindow(
    downsampledReference,
    options.topSkipRatio ?? DEFAULT_ALIGN_OPTIONS.topSkipRatio,
    options.windowHeightRatio ?? DEFAULT_ALIGN_OPTIONS.windowHeightRatio,
  );
  const windowHeight = getWindowHeight(
    downsampledReference.height,
    options.windowHeightRatio ?? DEFAULT_ALIGN_OPTIONS.windowHeightRatio,
  );
  const bestCandidate = findBestOffset(
    downsampledReference,
    downsampledDevice,
    windowY,
    windowHeight,
    Math.round(
      (options.maxDx ?? DEFAULT_ALIGN_OPTIONS.maxDx)
        * downsampleWidth
        / targetWidth,
    ),
    Math.round(
      downsampledReference.height
        * (options.maxDyRatio ?? DEFAULT_ALIGN_OPTIONS.maxDyRatio),
    ),
  );

  if (
    !bestCandidate
    || bestCandidate.score < (options.minScore ?? DEFAULT_ALIGN_OPTIONS.minScore)
  ) {
    return null;
  }

  const targetScale = targetWidth / downsampleWidth;
  const dx = Math.round(bestCandidate.dx * targetScale);
  const dy = Math.round(bestCandidate.dy * targetScale);
  const crop = getOverlapCrop(
    targetWidth,
    resizedReference.height,
    targetWidth,
    resizedDevice.height,
    dx,
    dy,
  );

  if (crop.width <= 0 || crop.height <= 0) {
    return null;
  }

  await Promise.all([
    sharp(resizedReference.buffer)
      .extract({
        height: crop.height,
        left: crop.referenceX,
        top: crop.referenceY,
        width: crop.width,
      })
      .png()
      .toFile(options.outputAlignedReferencePath),
    sharp(resizedDevice.buffer)
      .extract({
        height: crop.height,
        left: crop.deviceX,
        top: crop.deviceY,
        width: crop.width,
      })
      .png()
      .toFile(options.outputAlignedDevicePath),
  ]);

  return {
    crop: {
      h: crop.height,
      w: crop.width,
      x: crop.referenceX,
      y: crop.referenceY,
    },
    dx,
    dy,
    resizedHeight1: resizedReference.height,
    resizedHeight2: resizedDevice.height,
    resizedWidth: targetWidth,
    score: bestCandidate.score,
  };
}

async function resizeToWidth(
  imagePath: string,
  width: number,
): Promise<{ buffer: Buffer; height: number }> {
  const { data, info } = await sharp(imagePath)
    .resize({ width })
    .png()
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    height: info.height,
  };
}

async function toGrayImage(buffer: Buffer, width: number): Promise<RawGrayImage> {
  const { data, info } = await sharp(buffer)
    .resize({ width })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    channels: info.channels,
    data,
    height: info.height,
    width: info.width,
  };
}

function selectHighVarianceWindow(
  image: RawGrayImage,
  topSkipRatio: number,
  windowHeightRatio: number,
): number {
  const windowHeight = getWindowHeight(image.height, windowHeightRatio);
  const minY = Math.min(
    image.height - windowHeight,
    Math.max(0, Math.floor(image.height * topSkipRatio)),
  );
  const step = Math.max(1, Math.floor(windowHeight / 4));
  let bestVariance = Number.NEGATIVE_INFINITY;
  let bestY = minY;

  for (let y = minY; y <= image.height - windowHeight; y += step) {
    const variance = getWindowVariance(image, y, windowHeight);
    if (variance > bestVariance) {
      bestVariance = variance;
      bestY = y;
    }
  }

  return bestY;
}

function getWindowHeight(height: number, ratio: number): number {
  return Math.max(1, Math.min(height, Math.round(height * ratio)));
}

function getWindowVariance(
  image: RawGrayImage,
  y: number,
  windowHeight: number,
): number {
  let sum = 0;
  let sumSquares = 0;
  let count = 0;

  for (let yy = y; yy < y + windowHeight; yy++) {
    for (let x = 0; x < image.width; x++) {
      const value = getGrayPixel(image, x, yy);
      sum += value;
      sumSquares += value * value;
      count++;
    }
  }

  if (count === 0) return 0;
  const mean = sum / count;
  return sumSquares / count - mean * mean;
}

function findBestOffset(
  reference: RawGrayImage,
  device: RawGrayImage,
  windowY: number,
  windowHeight: number,
  maxDx: number,
  maxDy: number,
): CandidateScore | undefined {
  let best: CandidateScore | undefined;

  for (let dy = -maxDy; dy <= maxDy; dy++) {
    const deviceY = windowY + dy;
    if (deviceY < 0 || deviceY + windowHeight > device.height) {
      continue;
    }

    for (let dx = -maxDx; dx <= maxDx; dx++) {
      const score = getNormalizedCrossCorrelation(
        reference,
        device,
        windowY,
        deviceY,
        windowHeight,
        dx,
      );
      if (!best || score > best.score) {
        best = { dx, dy, score, windowY };
      }
    }
  }

  return best;
}

function getNormalizedCrossCorrelation(
  reference: RawGrayImage,
  device: RawGrayImage,
  referenceY: number,
  deviceY: number,
  windowHeight: number,
  dx: number,
): number {
  const referenceX = Math.max(0, -dx);
  const deviceX = Math.max(0, dx);
  const width = Math.min(reference.width - referenceX, device.width - deviceX);
  if (width <= 0) return Number.NEGATIVE_INFINITY;

  let referenceSum = 0;
  let deviceSum = 0;
  let count = 0;

  for (let y = 0; y < windowHeight; y++) {
    for (let x = 0; x < width; x++) {
      referenceSum += getGrayPixel(reference, referenceX + x, referenceY + y);
      deviceSum += getGrayPixel(device, deviceX + x, deviceY + y);
      count++;
    }
  }

  if (count === 0) return Number.NEGATIVE_INFINITY;

  const referenceMean = referenceSum / count;
  const deviceMean = deviceSum / count;
  let covariance = 0;
  let referenceVariance = 0;
  let deviceVariance = 0;

  for (let y = 0; y < windowHeight; y++) {
    for (let x = 0; x < width; x++) {
      const referenceDelta = getGrayPixel(
        reference,
        referenceX + x,
        referenceY + y,
      ) - referenceMean;
      const deviceDelta = getGrayPixel(device, deviceX + x, deviceY + y)
        - deviceMean;
      covariance += referenceDelta * deviceDelta;
      referenceVariance += referenceDelta * referenceDelta;
      deviceVariance += deviceDelta * deviceDelta;
    }
  }

  const denominator = Math.sqrt(referenceVariance * deviceVariance);
  return denominator === 0 ? 0 : covariance / denominator;
}

function getOverlapCrop(
  referenceWidth: number,
  referenceHeight: number,
  deviceWidth: number,
  deviceHeight: number,
  dx: number,
  dy: number,
): {
  deviceX: number;
  deviceY: number;
  height: number;
  referenceX: number;
  referenceY: number;
  width: number;
} {
  const referenceX = Math.max(0, -dx);
  const deviceX = Math.max(0, dx);
  const referenceY = Math.max(0, -dy);
  const deviceY = Math.max(0, dy);

  return {
    deviceX,
    deviceY,
    height: Math.min(referenceHeight - referenceY, deviceHeight - deviceY),
    referenceX,
    referenceY,
    width: Math.min(referenceWidth - referenceX, deviceWidth - deviceX),
  };
}

function getGrayPixel(image: RawGrayImage, x: number, y: number): number {
  return image.data[(y * image.width + x) * image.channels] ?? 0;
}
