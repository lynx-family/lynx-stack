// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Estimate the rendered height of a picture in a waterfall column.
 *
 * Uses SystemInfo for dynamic screen width (matching React Gallery original).
 */

declare const SystemInfo: { pixelWidth: number; pixelRatio: number };

export const calculateEstimatedSize = (
  pictureWidth: number,
  pictureHeight: number,
): number => {
  const galleryPadding = 20;
  const galleryMainAxisGap = 10;
  const gallerySpanCount = 2;
  const galleryWidth = SystemInfo.pixelWidth / SystemInfo.pixelRatio;
  const itemWidth = (galleryWidth - galleryPadding * 2 - galleryMainAxisGap)
    / gallerySpanCount;
  return (itemWidth / pictureWidth) * pictureHeight;
};
