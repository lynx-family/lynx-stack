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
  outputAlignedReferencePath: string;
  outputAlignedRenderedPath: string;
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
  renderedPath: string,
  options: AlignImagesOptions,
): Promise<AlignResult | null> {
  const referenceMetadata = await sharp(referencePath).metadata();
  const renderedMetadata = await sharp(renderedPath).metadata();
  const referenceWidth = referenceMetadata.width ?? 0;
  const renderedWidth = renderedMetadata.width ?? 0;

  if (referenceWidth <= 0 || renderedWidth <= 0) {
    return null;
  }

  const targetWidth = Math.max(
    1,
    Math.round(options.targetWidth ?? Math.min(referenceWidth, renderedWidth)),
  );
  const downsampleWidth = Math.max(
    1,
    Math.min(
      targetWidth,
      Math.round(
        options.downsampleWidth ?? DEFAULT_ALIGN_OPTIONS.downsampleWidth,
      ),
    ),
  );

  const [resizedReference, resizedRendered] = await Promise.all([
    resizeToWidth(referencePath, targetWidth),
    resizeToWidth(renderedPath, targetWidth),
  ]);
  const [downsampledReference, downsampledRendered] = await Promise.all([
    toGrayImage(resizedReference.buffer, downsampleWidth),
    toGrayImage(resizedRendered.buffer, downsampleWidth),
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
    downsampledRendered,
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
    || bestCandidate.score
      < (options.minScore ?? DEFAULT_ALIGN_OPTIONS.minScore)
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
    resizedRendered.height,
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
    sharp(resizedRendered.buffer)
      .extract({
        height: crop.height,
        left: crop.renderedX,
        top: crop.renderedY,
        width: crop.width,
      })
      .png()
      .toFile(options.outputAlignedRenderedPath),
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
    resizedHeight2: resizedRendered.height,
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

async function toGrayImage(
  buffer: Buffer,
  width: number,
): Promise<RawGrayImage> {
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
  rendered: RawGrayImage,
  windowY: number,
  windowHeight: number,
  maxDx: number,
  maxDy: number,
): CandidateScore | undefined {
  let best: CandidateScore | undefined;

  for (let dy = -maxDy; dy <= maxDy; dy++) {
    const renderedY = windowY + dy;
    if (renderedY < 0 || renderedY + windowHeight > rendered.height) {
      continue;
    }

    for (let dx = -maxDx; dx <= maxDx; dx++) {
      const score = getNormalizedCrossCorrelation(
        reference,
        rendered,
        windowY,
        renderedY,
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
  rendered: RawGrayImage,
  referenceY: number,
  renderedY: number,
  windowHeight: number,
  dx: number,
): number {
  const referenceX = Math.max(0, -dx);
  const renderedX = Math.max(0, dx);
  const width = Math.min(
    reference.width - referenceX,
    rendered.width - renderedX,
  );
  if (width <= 0) return Number.NEGATIVE_INFINITY;

  let referenceSum = 0;
  let renderedSum = 0;
  let count = 0;

  for (let y = 0; y < windowHeight; y++) {
    for (let x = 0; x < width; x++) {
      referenceSum += getGrayPixel(reference, referenceX + x, referenceY + y);
      renderedSum += getGrayPixel(rendered, renderedX + x, renderedY + y);
      count++;
    }
  }

  if (count === 0) return Number.NEGATIVE_INFINITY;

  const referenceMean = referenceSum / count;
  const renderedMean = renderedSum / count;
  let covariance = 0;
  let referenceVariance = 0;
  let renderedVariance = 0;

  for (let y = 0; y < windowHeight; y++) {
    for (let x = 0; x < width; x++) {
      const referenceDelta = getGrayPixel(
        reference,
        referenceX + x,
        referenceY + y,
      ) - referenceMean;
      const renderedDelta = getGrayPixel(
        rendered,
        renderedX + x,
        renderedY + y,
      ) - renderedMean;
      covariance += referenceDelta * renderedDelta;
      referenceVariance += referenceDelta * referenceDelta;
      renderedVariance += renderedDelta * renderedDelta;
    }
  }

  const denominator = Math.sqrt(referenceVariance * renderedVariance);
  return denominator === 0 ? 0 : covariance / denominator;
}

function getOverlapCrop(
  referenceWidth: number,
  referenceHeight: number,
  renderedWidth: number,
  renderedHeight: number,
  dx: number,
  dy: number,
): {
  height: number;
  referenceX: number;
  referenceY: number;
  renderedX: number;
  renderedY: number;
  width: number;
} {
  const referenceX = Math.max(0, -dx);
  const renderedX = Math.max(0, dx);
  const referenceY = Math.max(0, -dy);
  const renderedY = Math.max(0, dy);

  return {
    height: Math.min(
      referenceHeight - referenceY,
      renderedHeight - renderedY,
    ),
    referenceX,
    referenceY,
    renderedX,
    renderedY,
    width: Math.min(referenceWidth - referenceX, renderedWidth - renderedX),
  };
}

function getGrayPixel(image: RawGrayImage, x: number, y: number): number {
  return image.data[(y * image.width + x) * image.channels] ?? 0;
}
